import { NextRequest, NextResponse } from "next/server";
import { resendAccountVerification } from "@/lib/registration";
import { consumeRateLimit, identifierRateLimitKey, requestRateLimitKey } from "@/lib/rate-limit";
import { readLimitedJson } from "@/lib/request-body";

export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  try { if (!origin || new URL(origin).host !== request.headers.get("host")) return NextResponse.json({ message: "Request rejected." }, { status: 403 }); }
  catch { return NextResponse.json({ message: "Request rejected." }, { status: 403 }); }
  const body = await readLimitedJson(request, 4 * 1024);
  if (!body.ok) return NextResponse.json({ message: body.message }, { status: body.status });
  const email = typeof body.data === "object" && body.data !== null && "email" in body.data && typeof body.data.email === "string" ? body.data.email.trim().toLowerCase().slice(0, 254) : "";
  try {
    const key = requestRateLimitKey(request, "resend-verification", email);
    if (!(await consumeRateLimit(key, 3, 600))) return NextResponse.json({ message: "Too many requests. Please wait before trying again." }, { status: 429 });
    if (email && !(await consumeRateLimit(identifierRateLimitKey("email-verification-issue", email), 5, 3600))) {
      return NextResponse.json({ message: "Too many verification-code requests for this email. Please try again later." }, { status: 429 });
    }
  } catch { return NextResponse.json({ message: "Verification service is temporarily unavailable." }, { status: 503 }); }
  try {
    const result = await resendAccountVerification(body.data);
    return NextResponse.json({ message: result.message }, { status: result.ok ? 200 : result.status });
  } catch { return NextResponse.json({ message: "Unable to resend a verification code right now." }, { status: 500 }); }
}
