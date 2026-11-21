import { NextRequest, NextResponse } from "next/server";
import { verify } from "argon2";
import { z } from "zod";
import { auth } from "@/auth";
import { isSameOriginRequest } from "@/lib/request-security";
import { consumeRateLimit, requestRateLimitKey } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";
import { emailSecondFactorDigest, consumeEmailSecondFactorCode } from "@/lib/two-factor";
import { readLimitedJson } from "@/lib/request-body";

export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ message: "Request rejected." }, { status: 403 });
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ message: "Sign in required." }, { status: 401 });
  try {
    const key = requestRateLimitKey(request, "email-2fa-confirm", session.user.id);
    if (!(await consumeRateLimit(key, 8, 600))) return NextResponse.json({ message: "Too many code attempts. Try again later." }, { status: 429 });
  } catch {
    return NextResponse.json({ message: "Security service unavailable." }, { status: 503 });
  }
  const body = await readLimitedJson(request, 4 * 1024);
  if (!body.ok) return NextResponse.json({ message: body.message }, { status: body.status });
  const parsed = z.object({ code: z.string().regex(/^\d{6}$/), password: z.string().min(1).max(256) }).safeParse(body.data);
  if (!parsed.success) return NextResponse.json({ message: "Enter your password and the six-digit code." }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { id: true, email: true, passwordHash: true, twoFactorEnabled: true } });
  if (!user?.passwordHash || user.twoFactorEnabled) return NextResponse.json({ message: "Start two-factor setup after disabling the current method." }, { status: 409 });
  try {
    if (!(await verify(user.passwordHash, parsed.data.password))) return NextResponse.json({ message: "Verification failed." }, { status: 403 });
    const activated = await prisma.$transaction(async (tx) => {
      const accepted = await consumeEmailSecondFactorCode(
        tx,
        session.user.id,
        emailSecondFactorDigest(parsed.data.code, session.user.id, "activation"),
        true
      );
      if (!accepted) return false;
      await tx.auditEvent.create({
        data: {
          userId: session.user.id,
          actorEmail: user.email ?? undefined,
          action: "TWO_FACTOR_ENABLED_EMAIL",
          resource: "User",
          resourceId: session.user.id
        }
      });
      return true;
    });
    if (!activated) return NextResponse.json({ message: "The code is invalid or expired." }, { status: 400 });
    return NextResponse.json({ message: "Email two-factor authentication enabled. Sign in again to refresh your security session." });
  } catch {
    return NextResponse.json({ message: "Unable to confirm the code right now." }, { status: 503 });
  }
}
