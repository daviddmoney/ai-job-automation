import { NextResponse } from "next/server";
import { z } from "zod";
import { verify } from "argon2";
import { prisma } from "@/lib/prisma";
import { isSameOriginRequest } from "@/lib/request-security";
import { readLimitedJson } from "@/lib/request-body";
import { consumeRateLimit, identifierRateLimitKey, requestRateLimitKey } from "@/lib/rate-limit";
import { consumeEmailSecondFactorRecoveryCode, emailSecondFactorDigest } from "@/lib/two-factor";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ message: "Request rejected." }, { status: 403 });
  try {
    const bodyForLimit = await request.clone().json().catch(() => null) as { email?: unknown } | null;
    const emailForLimit = typeof bodyForLimit?.email === "string" ? bodyForLimit.email.trim().toLowerCase() : "";
    if (!(await consumeRateLimit(requestRateLimitKey(request, "two-factor-recovery-confirm", emailForLimit), 8, 3600))) {
      return NextResponse.json({ message: "Too many attempts. Try again later." }, { status: 429 });
    }
    if (emailForLimit && !(await consumeRateLimit(identifierRateLimitKey("two-factor-recovery-confirm", emailForLimit), 10, 3600))) {
      return NextResponse.json({ message: "Too many attempts. Try again later." }, { status: 429 });
    }
  } catch {
    return NextResponse.json({ message: "Account recovery is temporarily unavailable." }, { status: 503 });
  }
  const body = await readLimitedJson(request, 4 * 1024);
  if (!body.ok) return NextResponse.json({ message: body.message }, { status: body.status });
  const parsed = z.object({
    email: z.string().email().max(254),
    password: z.string().min(1).max(256),
    code: z.string().regex(/^\d{6}$/)
  }).safeParse(body.data);
  if (!parsed.success) return NextResponse.json({ message: "The recovery details are invalid or expired." }, { status: 400 });

  const email = parsed.data.email.trim().toLowerCase();
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, passwordHash: true, emailVerified: true, twoFactorEnabled: true, twoFactorMethod: true }
  });
  if (!user?.passwordHash || !user.emailVerified || !user.twoFactorEnabled || user.twoFactorMethod !== "TOTP") {
    return NextResponse.json({ message: "The recovery details are invalid or expired." }, { status: 400 });
  }

  try {
    if (!(await verify(user.passwordHash, parsed.data.password))) {
      return NextResponse.json({ message: "The recovery details are invalid or expired." }, { status: 400 });
    }
    const digest = emailSecondFactorDigest(parsed.data.code, user.id, "recovery");
    const recovered = await prisma.$transaction(async (tx) => {
      const accepted = await consumeEmailSecondFactorRecoveryCode(tx, user.id, digest);
      if (!accepted) return false;
      await tx.auditEvent.create({
        data: {
          userId: user.id,
          actorEmail: email,
          action: "TWO_FACTOR_RECOVERED",
          resource: "User",
          resourceId: user.id,
          details: "TOTP disabled after password and verified-email recovery proof."
        }
      });
      return true;
    });
    if (!recovered) return NextResponse.json({ message: "The recovery details are invalid or expired." }, { status: 400 });
    return NextResponse.json({ message: "Two-factor recovery completed. Sign in again with your password, then set up a new authenticator." });
  } catch {
    return NextResponse.json({ message: "Account recovery is temporarily unavailable." }, { status: 503 });
  }
}
