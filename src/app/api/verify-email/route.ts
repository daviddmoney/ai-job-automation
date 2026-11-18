import { NextRequest, NextResponse } from "next/server";
import { verifyAccountEmail } from "@/lib/registration";
import { consumeRateLimit, requestRateLimitKey } from "@/lib/rate-limit";
import { readLimitedJson } from "@/lib/request-body";
import { isSameOriginRequest } from "@/lib/request-security";

export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ message: "Request rejected." }, { status: 403 });
  const body = await readLimitedJson(request, 4 * 1024);
  if (!body.ok) return NextResponse.json({ message: body.message }, { status: body.status });
  const email = typeof body.data === "object" && body.data !== null && "email" in body.data && typeof body.data.email === "string" ? body.data.email : "";
  try {
    const key = requestRateLimitKey(request, "verify-email", email);
    if (!(await consumeRateLimit(key, 5, 600))) return NextResponse.json({ message: "Too many verification attempts. Request a new code later." }, { status: 429 });
  } catch { return NextResponse.json({ message: "Verification is temporarily unavailable." }, { status: 503 }); }
  try {
    const result = await verifyAccountEmail(body.data);
    return NextResponse.json({ message: result.message }, { status: result.ok ? 200 : result.status });
  } catch { return NextResponse.json({ message: "Unable to verify the account right now." }, { status: 500 }); }
}
