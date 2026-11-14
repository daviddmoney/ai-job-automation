import { NextRequest, NextResponse } from "next/server";
import { verifyAccountEmail } from "@/lib/registration";
import { consumeRateLimit, requestRateLimitKey } from "@/lib/rate-limit";

export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  try { if (!origin || new URL(origin).host !== request.headers.get("host")) return NextResponse.json({ message: "Request rejected." }, { status: 403 }); }
  catch { return NextResponse.json({ message: "Request rejected." }, { status: 403 }); }
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ message: "Invalid request." }, { status: 400 }); }
  const email = typeof body === "object" && body !== null && "email" in body && typeof body.email === "string" ? body.email : "";
  try {
    const key = requestRateLimitKey(request, "verify-email", email);
    if (!(await consumeRateLimit(key, 5, 600))) return NextResponse.json({ message: "Too many verification attempts. Request a new code later." }, { status: 429 });
  } catch { return NextResponse.json({ message: "Verification is temporarily unavailable." }, { status: 503 }); }
  try {
    const result = await verifyAccountEmail(body);
    return NextResponse.json({ message: result.message }, { status: result.ok ? 200 : result.status });
  } catch { return NextResponse.json({ message: "Unable to verify the account right now." }, { status: 500 }); }
}
