import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isSameOriginRequest } from "@/lib/request-security";
import { consumeRateLimit, requestRateLimitKey } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";
import { newEmailOtp, emailSecondFactorDigest } from "@/lib/two-factor";
import { sendSecondFactorCode } from "@/lib/email";

export const runtime = "nodejs";
export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ message: "Request rejected." }, { status: 403 });
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ message: "Sign in required." }, { status: 401 });
  try { const key = requestRateLimitKey(request, "email-2fa-start", session.user.id); if (!(await consumeRateLimit(key, 3, 600))) return NextResponse.json({ message: "Too many code requests. Try again later." }, { status: 429 }); } catch { return NextResponse.json({ message: "Security service unavailable." }, { status: 503 }); }
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { email: true, emailVerified: true } });
  if (!user?.email || !user.emailVerified) return NextResponse.json({ message: "A verified email is required." }, { status: 400 });
  const code = newEmailOtp();
  await prisma.user.update({ where: { id: session.user.id }, data: { twoFactorEmailCodeHash: emailSecondFactorDigest(code), twoFactorEmailCodeExpiresAt: new Date(Date.now() + 5 * 60 * 1000), twoFactorEmailCodeAttempts: 0 } });
  try { await sendSecondFactorCode(user.email, code); return NextResponse.json({ message: "A confirmation code has been sent to your verified email." }); }
  catch { return NextResponse.json({ message: "Email delivery is not configured or is temporarily unavailable." }, { status: 503 }); }
}
