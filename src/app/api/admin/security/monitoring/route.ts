import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { consumeRateLimit, requestRateLimitKey } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ message: "Sign in required." }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true, emailVerified: true }
  });
  if (!user?.emailVerified || user.role !== "STAFF") {
    return NextResponse.json({ message: "Staff access required." }, { status: 403 });
  }

  try {
    const key = requestRateLimitKey(request, "staff-security-monitoring", session.user.id);
    if (!(await consumeRateLimit(key, 30, 60))) {
      return NextResponse.json({ message: "Too many requests." }, { status: 429 });
    }
  } catch {
    return NextResponse.json({ message: "Security monitoring is temporarily unavailable." }, { status: 503 });
  }

  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const [totalBuckets, expiredBuckets, deniedLastHour, deniedLast24Hours] = await Promise.all([
    prisma.rateLimitBucket.count(),
    prisma.rateLimitBucket.count({ where: { resetAt: { lte: now } } }),
    prisma.auditEvent.count({ where: { action: "RATE_LIMIT_DENIED", createdAt: { gte: oneHourAgo } } }),
    prisma.auditEvent.count({ where: { action: "RATE_LIMIT_DENIED", createdAt: { gte: oneDayAgo } } })
  ]);

  return NextResponse.json({
    generatedAt: now.toISOString(),
    rateLimits: { totalBuckets, expiredBuckets, deniedLastHour, deniedLast24Hours },
    retention: { rateLimitDenialEventsDays: 90, cleanup: "opportunistic every 100 rate-limit checks; manual cron script also available" }
  });
}
