import { NextRequest, NextResponse } from "next/server";
import { verify } from "argon2";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { issueEmailTwoFactorCode, newEmailOtp, emailSecondFactorDigest } from "@/lib/two-factor";
import { sendSecondFactorCode } from "@/lib/email";
import { readLimitedJson } from "@/lib/request-body";
import { consumeRateLimit, identifierRateLimitKey, requestRateLimitKey } from "@/lib/rate-limit";

export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  try { if (!origin || new URL(origin).host !== request.headers.get("host")) return NextResponse.json({ message: "Request rejected." }, { status: 403 }); }
  catch { return NextResponse.json({ message: "Request rejected." }, { status: 403 }); }
  const body = await readLimitedJson(request, 8 * 1024);
  if (!body.ok) return NextResponse.json({ message: body.message }, { status: body.status });
  const parsed = z.object({ email: z.string().email().max(254), password: z.string().min(1).max(256) }).safeParse(body.data);
  if (!parsed.success) return NextResponse.json({ message: "Enter your email and password first." }, { status: 400 });
  const email = parsed.data.email.trim().toLowerCase();
  try {
    const key = requestRateLimitKey(request, "send-2fa", email);
    if (!(await consumeRateLimit(key, 3, 600))) return NextResponse.json({ message: "Too many code requests. Please wait before trying again." }, { status: 429 });
  } catch { return NextResponse.json({ message: "Sign-in code delivery is temporarily unavailable." }, { status: 503 }); }
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user?.passwordHash || !user.emailVerified || !user.twoFactorEnabled || user.twoFactorMethod !== "EMAIL") return NextResponse.json({ message: "Unable to send a sign-in code for this account." }, { status: 400 });
  try { if (!(await verify(user.passwordHash, parsed.data.password))) return NextResponse.json({ message: "Unable to send a sign-in code for this account." }, { status: 400 }); }
  catch { return NextResponse.json({ message: "Unable to send a sign-in code for this account." }, { status: 400 }); }
  try {
    if (!(await consumeRateLimit(identifierRateLimitKey("email-2fa-issue", email), 3, 600))) {
      return NextResponse.json({ message: "Too many code requests. Please wait before trying again." }, { status: 429 });
    }
  } catch { return NextResponse.json({ message: "Sign-in code delivery is temporarily unavailable." }, { status: 503 }); }
  const code = newEmailOtp();
  const issued = await issueEmailTwoFactorCode(prisma, user.id, emailSecondFactorDigest(code));
  if (!issued) return NextResponse.json({ message: "Unable to send a sign-in code for this account." }, { status: 400 });
  try { await sendSecondFactorCode(user.email, code); return NextResponse.json({ message: "A sign-in code has been sent to your verified email." }); }
  catch { return NextResponse.json({ message: "Email delivery is temporarily unavailable." }, { status: 503 }); }
}
