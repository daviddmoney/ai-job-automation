import { NextRequest, NextResponse } from "next/server";
import { verify } from "argon2";
import { z } from "zod";
import { auth } from "@/auth";
import { isSameOriginRequest } from "@/lib/request-security";
import { consumeRateLimit, requestRateLimitKey } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";
import { decryptTotpSecret, verifyTotpCounter } from "@/lib/two-factor";
import { readLimitedJson } from "@/lib/request-body";

export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ message: "Request rejected." }, { status: 403 });
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ message: "Sign in required." }, { status: 401 });
  try {
    const key = requestRateLimitKey(request, "totp-confirm", session.user.id);
    if (!(await consumeRateLimit(key, 8, 600))) return NextResponse.json({ message: "Too many code attempts. Try again later." }, { status: 429 });
  } catch {
    return NextResponse.json({ message: "Security service unavailable." }, { status: 503 });
  }
  const body = await readLimitedJson(request, 4 * 1024);
  if (!body.ok) return NextResponse.json({ message: body.message }, { status: body.status });
  const parsed = z.object({ code: z.string().regex(/^\d{6}$/), password: z.string().min(1).max(256) }).safeParse(body.data);
  if (!parsed.success) return NextResponse.json({ message: "Enter your password and a six-digit authenticator code." }, { status: 400 });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { email: true, passwordHash: true, twoFactorPendingSecretCipher: true, twoFactorEnabled: true, sessionVersion: true }
  });
  if (!user?.passwordHash || !user.twoFactorPendingSecretCipher || user.twoFactorEnabled) {
    return NextResponse.json({ message: "Start authenticator setup first, after disabling any existing method." }, { status: 409 });
  }
  try {
    if (!(await verify(user.passwordHash, parsed.data.password))) return NextResponse.json({ message: "Verification failed." }, { status: 403 });
    const secret = decryptTotpSecret(user.twoFactorPendingSecretCipher);
    const counter = verifyTotpCounter(secret, parsed.data.code);
    if (counter === null) return NextResponse.json({ message: "The code is invalid or expired." }, { status: 400 });
    const activated = await prisma.$transaction(async (tx) => {
      const changed = await tx.user.updateMany({
        where: {
          id: session.user.id,
          twoFactorEnabled: false,
          sessionVersion: user.sessionVersion,
          twoFactorPendingSecretCipher: user.twoFactorPendingSecretCipher,
          OR: [{ twoFactorLastTotpCounter: null }, { twoFactorLastTotpCounter: { lt: BigInt(counter) } }]
        },
        data: {
          twoFactorSecretCipher: user.twoFactorPendingSecretCipher,
          twoFactorPendingSecretCipher: null,
          twoFactorEnabled: true,
          twoFactorMethod: "TOTP",
          twoFactorLastTotpCounter: BigInt(counter),
          recoveryCodeHashes: [],
          sessionVersion: { increment: 1 }
        }
      });
      if (changed.count !== 1) return false;
      await tx.auditEvent.create({
        data: {
          userId: session.user.id,
          actorEmail: user.email ?? undefined,
          action: "TWO_FACTOR_ENABLED_TOTP",
          resource: "User",
          resourceId: session.user.id
        }
      });
      return true;
    });
    if (!activated) return NextResponse.json({ message: "This authenticator code has already been used or settings changed." }, { status: 409 });
    return NextResponse.json({ message: "Authenticator two-factor authentication enabled. Sign in again to refresh your security session." });
  } catch {
    return NextResponse.json({ message: "Authenticator setup could not be completed." }, { status: 503 });
  }
}
