import { NextRequest, NextResponse } from "next/server";
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
  try { const key = requestRateLimitKey(request, "email-2fa-confirm", session.user.id); if (!(await consumeRateLimit(key, 8, 600))) return NextResponse.json({ message: "Too many code attempts. Try again later." }, { status: 429 }); }
  catch { return NextResponse.json({ message: "Security service unavailable." }, { status: 503 }); }
  const body = await readLimitedJson(request, 4 * 1024);
  if (!body.ok) return NextResponse.json({ message: body.message }, { status: body.status });
  const parsed = z.object({ code: z.string().regex(/^\d{6}$/) }).safeParse(body.data);
  if (!parsed.success) return NextResponse.json({ message: "Enter the six-digit code sent to your email." }, { status: 400 });
  try {
    const activated = await consumeEmailSecondFactorCode(prisma, session.user.id, emailSecondFactorDigest(parsed.data.code), true);
    if (!activated) return NextResponse.json({ message: "The code is invalid or expired." }, { status: 400 });
    return NextResponse.json({ message: "Email two-factor authentication enabled." });
  } catch {
    return NextResponse.json({ message: "Unable to confirm the code right now." }, { status: 503 });
  }
}
