import { NextResponse } from "next/server";
import { verify } from "argon2";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isSameOriginRequest } from "@/lib/request-security";
import { readLimitedJson } from "@/lib/request-body";
import { consumeRateLimit, identifierRateLimitKey, requestRateLimitKey } from "@/lib/rate-limit";
import { emailSecondFactorDigest, issueEmailSecondFactorCode, newEmailOtp } from "@/lib/two-factor";
import { sendSecondFactorCode } from "@/lib/email";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ message: "Request rejected." }, { status: 403 });
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ message: "Sign in required." }, { status: 401 });
  const body = await readLimitedJson(request, 4 * 1024);
  if (!body.ok) return NextResponse.json({ message: body.message }, { status: body.status });
  const parsed = z.object({ password: z.string().min(1).max(256) }).safeParse(body.data);
  if (!parsed.success) return NextResponse.json({ message: "Enter your current password." }, { status: 400 });

  try {
    const key = requestRateLimitKey(request, "two-factor-disable-code", session.user.id);
    if (!(await consumeRateLimit(key, 3, 600))) return NextResponse.json({ message: "Too many code requests. Try again later." }, { status: 429 });
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, email: true, emailVerified: true, passwordHash: true, twoFactorEnabled: true, twoFactorMethod: true }
    });
    if (!user?.email || !user.emailVerified || !user.passwordHash || !user.twoFactorEnabled || user.twoFactorMethod !== "EMAIL") {
      return NextResponse.json({ message: "Email-based two-factor authentication is not active." }, { status: 409 });
    }
    if (!(await verify(user.passwordHash, parsed.data.password))) return NextResponse.json({ message: "Verification failed." }, { status: 403 });
    if (!(await consumeRateLimit(identifierRateLimitKey("two-factor-disable-code-email", user.email), 3, 3600))) {
      return NextResponse.json({ message: "Too many code requests. Try again later." }, { status: 429 });
    }
    const code = newEmailOtp();
    const digest = emailSecondFactorDigest(code, user.id, "login");
    const issued = await issueEmailSecondFactorCode(prisma, user.id, digest, 5, "login");
    if (!issued) return NextResponse.json({ message: "Two-factor settings changed. Refresh and try again." }, { status: 409 });
    try {
      await sendSecondFactorCode(user.email, code);
      return NextResponse.json({ message: "A fresh confirmation code has been sent to your verified email." });
    } catch {
      await prisma.user.updateMany({
        where: { id: user.id, twoFactorEmailCodeHash: digest },
        data: { twoFactorEmailCodeHash: null, twoFactorEmailCodeExpiresAt: null, twoFactorEmailCodeAttempts: 0 }
      });
      return NextResponse.json({ message: "Email delivery is temporarily unavailable." }, { status: 503 });
    }
  } catch {
    return NextResponse.json({ message: "Unable to send a confirmation code." }, { status: 503 });
  }
}
