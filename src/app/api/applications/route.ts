import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isSameOriginRequest } from "@/lib/request-security";
import { readLimitedJson } from "@/lib/request-body";
import { ApplicationStatus } from "@prisma/client";
export const runtime = "nodejs";
const createSchema = z.object({ jobPostingId: z.string().min(1).max(100) });
const updateSchema = z.object({ applicationId: z.string().min(1).max(100), status: z.nativeEnum(ApplicationStatus).optional(), notes: z.string().max(5000).optional() }).refine(v => v.status !== undefined || v.notes !== undefined);
export async function GET() {
 const session = await auth();
 if (!session?.user?.id) return NextResponse.json({ message: "Sign in required." }, { status: 401 });
 const applications = await prisma.application.findMany({ where: { userId: session.user.id }, include: { jobPosting: true }, orderBy: { updatedAt: "desc" }, take: 100 });
 return NextResponse.json({ applications });
}
export async function POST(request: NextRequest) {
 if (!isSameOriginRequest(request)) return NextResponse.json({ message: "Request rejected." }, { status: 403 });
 const session = await auth();
 if (!session?.user?.id) return NextResponse.json({ message: "Sign in required." }, { status: 401 });
 const body = await readLimitedJson(request, 8 * 1024);
 if (!body.ok) return NextResponse.json({ message: body.message }, { status: body.status });
 const parsed = createSchema.safeParse(body.data);
 if (!parsed.success) return NextResponse.json({ message: "Invalid job reference." }, { status: 400 });
 const job = await prisma.jobPosting.findFirst({ where: { id: parsed.data.jobPostingId, status: "ACTIVE", OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] } });
 if (!job) return NextResponse.json({ message: "This opportunity is no longer available." }, { status: 404 });
 const application = await prisma.application.upsert({
  where: { userId_jobPostingId: { userId: session.user.id, jobPostingId: job.id } },
  create: { userId: session.user.id, jobPostingId: job.id, company: job.company, jobTitle: job.title, jobUrl: job.applicationUrl, workLocation: job.locationText, workMode: job.workMode, source: job.source, publishedAt: job.publishedAt, status: "SAVED" },
  update: {}
 });
 await prisma.auditEvent.create({ data: { userId: session.user.id, action: "APPLICATION_CREATED", resource: "Application", resourceId: application.id } });
 return NextResponse.json({ message: "Job added to your application tracker or was already present.", applicationId: application.id });
}
export async function PATCH(request: NextRequest) {
 if (!isSameOriginRequest(request)) return NextResponse.json({ message: "Request rejected." }, { status: 403 });
 const session = await auth();
 if (!session?.user?.id) return NextResponse.json({ message: "Sign in required." }, { status: 401 });
 const body = await readLimitedJson(request, 16 * 1024);
 if (!body.ok) return NextResponse.json({ message: body.message }, { status: body.status });
 const parsed = updateSchema.safeParse(body.data);
 if (!parsed.success) return NextResponse.json({ message: "Invalid application update." }, { status: 400 });
 const owned = await prisma.application.findFirst({ where: { id: parsed.data.applicationId, userId: session.user.id }, select: { id: true } });
 if (!owned) return NextResponse.json({ message: "Application not found." }, { status: 404 });
 await prisma.application.update({ where: { id: owned.id }, data: { ...(parsed.data.status ? { status: parsed.data.status } : {}), ...(parsed.data.notes !== undefined ? { notes: parsed.data.notes } : {}) } });
 await prisma.auditEvent.create({ data: { userId: session.user.id, action: "APPLICATION_UPDATED", resource: "Application", resourceId: owned.id } });
 return NextResponse.json({ message: "Application tracker updated." });
}
