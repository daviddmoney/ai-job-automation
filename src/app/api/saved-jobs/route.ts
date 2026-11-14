import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isSameOriginRequest } from "@/lib/request-security";

export const runtime = "nodejs";
const schema = z.object({ jobPostingId: z.string().min(1).max(100) });
export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ message: "Request rejected." }, { status: 403 });
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ message: "Sign in required." }, { status: 401 });
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ message: "Invalid job reference." }, { status: 400 });
  const job = await prisma.jobPosting.findFirst({ where: { id: parsed.data.jobPostingId, status: "ACTIVE", country: "Nigeria", OR: [{ workMode: { in: ["ONSITE", "HYBRID"] }, city: "Lagos" }, { workMode: "REMOTE", eligibleLocations: { hasSome: ["Lagos", "Lagos, Nigeria"] } }] }, select: { id: true } });
  if (!job) return NextResponse.json({ message: "This opportunity is not available in the Lagos job list." }, { status: 404 });
  await prisma.savedJob.upsert({ where: { userId_jobPostingId: { userId: session.user.id, jobPostingId: job.id } }, create: { userId: session.user.id, jobPostingId: job.id }, update: {} });
  return NextResponse.json({ message: "Job saved to your private list." }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ message: "Request rejected." }, { status: 403 });
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ message: "Sign in required." }, { status: 401 });
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ message: "Invalid job reference." }, { status: 400 });
  await prisma.savedJob.deleteMany({ where: { userId: session.user.id, jobPostingId: parsed.data.jobPostingId } });
  return NextResponse.json({ message: "Job removed from your saved list." });
}
