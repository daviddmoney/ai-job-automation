import { NextRequest, NextResponse } from "next/server";
import { registerAccount } from "@/lib/registration";
import { consumeRateLimit, requestRateLimitKey } from "@/lib/rate-limit";

export const runtime = "nodejs";
function sameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try { return new URL(origin).host === request.headers.get("host"); } catch { return false; }
}
export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ message: "Request rejected." }, { status: 403 });
  try {
    const key = requestRateLimitKey(request, "register");
    if (!(await consumeRateLimit(key, 8, 60))) return NextResponse.json({ message: "Too many attempts. Please wait before trying again." }, { status: 429 });
  } catch { return NextResponse.json({ message: "Registration is temporarily unavailable." }, { status: 503 }); }
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ message: "Invalid request." }, { status: 400 }); }
  try {
    const result = await registerAccount(body);
    return NextResponse.json({ message: result.message }, { status: result.ok ? 201 : result.status });
  } catch { return NextResponse.json({ message: "Unable to create the account right now." }, { status: 500 }); }
}
