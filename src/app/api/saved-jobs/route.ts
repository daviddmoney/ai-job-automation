import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isSameOriginRequest } from "@/lib/request-security";
import { readLimitedJson } from "@/lib/request-body";
export const runtime = "nodejs";
const schema = z.object({ jobPostingId: z.string().min(1).max(100) });
async function body(request: NextRequest) {
 const result = await readLimitedJson(request, 8 * 1024);
 if (!result.ok) return { response: NextResponse.json({ message: result.message }, { status: result.status }) };
 const parsed = schema.safeParse(result.data);
 if (!parsed.success) return { response: NextResponse.json({ message: "Invalid job reference." }, { status: 400 }) };
 return { data: parsed.data };
}
export async function POST(request: NextRequest) {
 if (!isSameOriginRequest(request)) return NextResponse.json({ message: "Request rejected." }, { status: 403 });
 const session = await auth();
 if (!session?.user?.id) return NextResponse.json({ message: "Sign in required." }, { status: 401 });
 const parsed = await body(request);
 if ("response" in parsed) return parsed.response;
 const job = await prisma.jobPosting.findFirst({ where: { id: parsed.data.jobPostingId, status: "ACTIVE", OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] }, select: { id: true } });
 if (!job) return NextResponse.json({ message: "This opportunity is no longer available." }, { status: 404 });
 await prisma.savedJob.upsert({ where: { userId_jobPostingId: { userId: session.user.id, jobPostingId: job.id } }, create: { userId: session.user.id, jobPostingId: job.id }, update: {} });
 return NextResponse.json({ message: "Job saved to your private list." }, { status: 201 });
}
export async function DELETE(request: NextRequest) {
 if (!isSameOriginRequest(request)) return NextResponse.json({ message: "Request rejected." }, { status: 403 });
 const session = await auth();
 if (!session?.user?.id) return NextResponse.json({ message: "Sign in required." }, { status: 401 });
 const parsed = await body(request);
 if ("response" in parsed) return parsed.response;
 await prisma.savedJob.deleteMany({ where: { userId: session.user.id, jobPostingId: parsed.data.jobPostingId } });
 return NextResponse.json({ message: "Job removed from your saved list." });
}
