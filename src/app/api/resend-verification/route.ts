import { NextRequest, NextResponse } from "next/server";
import { resendAccountVerification } from "@/lib/registration";
import { consumeRateLimit, requestRateLimitKey } from "@/lib/rate-limit";
import { readLimitedJson } from "@/lib/request-body";
import { isSameOriginRequest } from "@/lib/request-security";

export const runtime = "nodejs";
const genericResendMessage = "If an account needs verification, a new code will be sent when email delivery is available. Check your inbox and spam folder. If no code arrives, try again later or contact support.";

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ message: "Request rejected." }, { status: 403 });
  const body = await readLimitedJson(request, 4 * 1024);
  if (!body.ok) return NextResponse.json({ message: body.message }, { status: body.status });
  const email = typeof body.data === "object" && body.data !== null && "email" in body.data && typeof body.data.email === "string" ? body.data.email : "";
  try {
    const key = requestRateLimitKey(request, "resend-verification", email);
    if (!(await consumeRateLimit(key, 3, 600))) return NextResponse.json({ message: "Too many requests. Please wait before trying again." }, { status: 429 });
  } catch {
    return NextResponse.json({ message: "Verification service is temporarily unavailable." }, { status: 503 });
  }
  try {
    await resendAccountVerification(body.data);
  } catch {
    // Do not expose whether the address belongs to an account or whether delivery failed.
  }
  return NextResponse.json({ message: genericResendMessage }, { status: 200 });
}
