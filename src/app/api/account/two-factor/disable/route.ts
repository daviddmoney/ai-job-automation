import { NextRequest, NextResponse } from "next/server";
import { verify } from "argon2";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isSameOriginRequest } from "@/lib/request-security";
import { readLimitedJson } from "@/lib/request-body";
import { consumeRateLimit, requestRateLimitKey } from "@/lib/rate-limit";
import {
  consumeEmailSecondFactorCode,
  decryptTotpSecret,
  emailSecondFactorDigest,
  otpDigest,
  verifyTotpCounter
} from "@/lib/two-factor";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ message: "Request rejected." }, { status: 403 });
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ message: "Sign in required." }, { status: 401 });
  try {
    const key = requestRateLimitKey(request, "two-factor-disable", session.user.id);
    if (!(await consumeRateLimit(key, 3, 3600))) return NextResponse.json({ message: "Too many attempts. Try again later." }, { status: 429 });
  } catch {
    return NextResponse.json({ message: "Security service unavailable." }, { status: 503 });
  }

  const body = await readLimitedJson(request, 4 * 1024);
  if (!body.ok) return NextResponse.json({ message: body.message }, { status: body.status });
  const parsed = z.object({
    password: z.string().min(1).max(256),
    code: z.string().regex(/^(?:\d{6}|[A-Fa-f0-9]{16})$/)
  }).safeParse(body.data);
  if (!parsed.success) return NextResponse.json({ message: "Enter your password and current authenticator, email, or recovery code." }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user?.passwordHash || !user.twoFactorEnabled || !user.twoFactorMethod) {
    return NextResponse.json({ message: "Two-factor authentication is not enabled." }, { status: 409 });
  }
  try {
    if (!(await verify(user.passwordHash, parsed.data.password))) {
      return NextResponse.json({ message: "Verification failed." }, { status: 403 });
    }

    const disabled = await prisma.$transaction(async (tx) => {
      if (user.twoFactorMethod === "EMAIL") {
        if (!/^\d{6}$/.test(parsed.data.code)) return false;
        const consumed = await consumeEmailSecondFactorCode(
          tx,
          user.id,
          emailSecondFactorDigest(parsed.data.code, user.id, "login")
        );
        if (!consumed) return false;
        const changed = await tx.user.updateMany({
          where: { id: user.id, twoFactorEnabled: true, twoFactorMethod: "EMAIL", sessionVersion: user.sessionVersion },
          data: {
            twoFactorEnabled: false,
            twoFactorMethod: null,
            twoFactorSecretCipher: null,
            twoFactorPendingSecretCipher: null,
            recoveryCodeHashes: [],
            twoFactorEmailCodeHash: null,
            twoFactorEmailCodeExpiresAt: null,
            twoFactorEmailCodeAttempts: 0,
            sessionVersion: { increment: 1 }
          }
        });
        if (changed.count !== 1) return false;
      } else if (user.twoFactorMethod === "TOTP") {
        if (/^\d{6}$/.test(parsed.data.code)) {
          if (!user.twoFactorSecretCipher) return false;
          const counter = verifyTotpCounter(decryptTotpSecret(user.twoFactorSecretCipher), parsed.data.code);
          if (counter === null) return false;
          const changed = await tx.user.updateMany({
            where: {
              id: user.id,
              twoFactorEnabled: true,
              twoFactorMethod: "TOTP",
              twoFactorSecretCipher: user.twoFactorSecretCipher,
              sessionVersion: user.sessionVersion,
              OR: [{ twoFactorLastTotpCounter: null }, { twoFactorLastTotpCounter: { lt: BigInt(counter) } }]
            },
            data: {
              twoFactorEnabled: false,
              twoFactorMethod: null,
              twoFactorSecretCipher: null,
              twoFactorPendingSecretCipher: null,
              recoveryCodeHashes: [],
              twoFactorEmailCodeHash: null,
              twoFactorEmailCodeExpiresAt: null,
              twoFactorEmailCodeAttempts: 0,
              twoFactorLastTotpCounter: BigInt(counter),
              sessionVersion: { increment: 1 }
            }
          });
          if (changed.count !== 1) return false;
        } else {
          const digest = otpDigest(parsed.data.code.toUpperCase());
          const rows = await tx.$queryRaw<Array<{ id: string }>>`
            UPDATE "User"
            SET
              "twoFactorEnabled" = FALSE,
              "twoFactorMethod" = NULL,
              "twoFactorSecretCipher" = NULL,
              "twoFactorPendingSecretCipher" = NULL,
              "recoveryCodeHashes" = ARRAY[]::text[],
              "twoFactorEmailCodeHash" = NULL,
              "twoFactorEmailCodeExpiresAt" = NULL,
              "twoFactorEmailCodeAttempts" = 0,
              "sessionVersion" = "sessionVersion" + 1,
              "updatedAt" = (clock_timestamp() AT TIME ZONE 'UTC')
            WHERE "id" = ${user.id}
              AND "twoFactorEnabled" = TRUE
              AND "twoFactorMethod" = 'TOTP'
              AND "sessionVersion" = ${user.sessionVersion}
              AND ${digest} = ANY("recoveryCodeHashes")
            RETURNING "id"
          `;
          if (rows.length !== 1) return false;
        }
      } else {
        return false;
      }

      await tx.auditEvent.create({
        data: {
          userId: user.id,
          actorEmail: user.email ?? undefined,
          action: "TWO_FACTOR_DISABLED",
          resource: "User",
          resourceId: user.id,
          details: "Disabled after password and current second-factor proof."
        }
      });
      return true;
    });

    if (!disabled) return NextResponse.json({ message: "Verification failed, the code has expired, or settings changed." }, { status: 403 });
    return NextResponse.json({ message: "Two-factor authentication disabled. All existing sessions have been revoked; sign in again." });
  } catch {
    return NextResponse.json({ message: "Unable to update two-factor settings." }, { status: 503 });
  }
}
