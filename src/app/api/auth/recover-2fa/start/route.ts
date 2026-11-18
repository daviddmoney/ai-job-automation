import { NextResponse } from "next/server";
import { z } from "zod";
import { verify } from "argon2";
import { prisma } from "@/lib/prisma";
import { isSameOriginRequest } from "@/lib/request-security";
import { readLimitedJson } from "@/lib/request-body";
import { consumeRateLimit, identifierRateLimitKey, requestRateLimitKey } from "@/lib/rate-limit";
import { emailSecondFactorDigest, issueEmailSecondFactorCode, newEmailOtp } from "@/lib/two-factor";
import { sendAccountRecoveryCode } from "@/lib/email";

export const runtime = "nodejs";
const genericMessage = "If the account is eligible for recovery, a one-time code will be sent to its verified email.";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ message: "Request rejected." }, { status: 403 });
  const body = await readLimitedJson(request, 4 * 1024);
  if (!body.ok) return NextResponse.json({ message: body.message }, { status: body.status });
  const parsed = z.object({
    email: z.string().email().max(254),
    password: z.string().min(1).max(256)
  }).safeParse(body.data);
  if (!parsed.success) return NextResponse.json({ message: genericMessage });
  const email = parsed.data.email.trim().toLowerCase();

  try {
    if (!(await consumeRateLimit(requestRateLimitKey(request, "two-factor-recovery-start", email), 5, 3600))) {
      return NextResponse.json({ message: "Too many requests. Try again later." }, { status: 429 });
    }
    if (!(await consumeRateLimit(identifierRateLimitKey("two-factor-recovery-email", email), 2, 3600))) {
      return NextResponse.json({ message: "Too many requests. Try again later." }, { status: 429 });
    }
  } catch {
    return NextResponse.json({ message: "Account recovery is temporarily unavailable." }, { status: 503 });
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, passwordHash: true, emailVerified: true, twoFactorEnabled: true, twoFactorMethod: true }
  });
  if (user?.passwordHash && user.emailVerified && user.twoFactorEnabled && user.twoFactorMethod === "TOTP") {
    try {
      if (await verify(user.passwordHash, parsed.data.password)) {
        const code = newEmailOtp();
        const digest = emailSecondFactorDigest(code, user.id, "recovery");
        const issued = await issueEmailSecondFactorCode(prisma, user.id, digest, 10, "recovery");
        if (issued) {
          try { await sendAccountRecoveryCode(user.email, code); }
          catch {
            await prisma.user.updateMany({
              where: { id: user.id, twoFactorEmailCodeHash: digest },
              data: { twoFactorEmailCodeHash: null, twoFactorEmailCodeExpiresAt: null }
            });
            console.error(JSON.stringify({ event: "two_factor_recovery_email_delivery_failed" }));
          }
        }
      }
    } catch {
      // Preserve the generic response to avoid account enumeration.
    }
  }
  return NextResponse.json({ message: genericMessage });
}
