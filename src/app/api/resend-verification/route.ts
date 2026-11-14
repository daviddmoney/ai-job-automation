import { NextRequest, NextResponse } from "next/server";
import { resendAccountVerification } from "@/lib/registration";
import { consumeRateLimit, requestRateLimitKey } from "@/lib/rate-limit";

export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  try { if (!origin || new URL(origin).host !== request.headers.get("host")) return NextResponse.json({ message: "Request rejected." }, { status: 403 }); }
  catch { return NextResponse.json({ message: "Request rejected." }, { status: 403 }); }
  const body = await request.json().catch(() => null);
  const email = typeof body === "object" && body !== null && "email" in body && typeof body.email === "string" ? body.email : "";
  try { const key = requestRateLimitKey(request, "resend-verification", email); if (!(await consumeRateLimit(key, 3, 600))) return NextResponse.json({ message: "Too many requests. Please wait before trying again." }, { status: 429 }); }
  catch { return NextResponse.json({ message: "Verification service is temporarily unavailable." }, { status: 503 }); }
  try { const result = await resendAccountVerification(body); return NextResponse.json({ message: result.message }, { status: result.ok ? 200 : result.status }); }
  catch { return NextResponse.json({ message: "Unable to resend a verification code right now." }, { status: 500 }); }
}
