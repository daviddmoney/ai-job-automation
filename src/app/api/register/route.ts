import { NextRequest, NextResponse } from "next/server";
import { registerAccount } from "@/lib/registration";
import { consumeRateLimit, identifierRateLimitKey, requestRateLimitKey } from "@/lib/rate-limit";
import { readLimitedJson } from "@/lib/request-body";

export const runtime = "nodejs";
function sameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try { return new URL(origin).host === request.headers.get("host"); } catch { return false; }
}
export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ message: "Request rejected." }, { status: 403 });
  const parsedBody = await readLimitedJson(request, 16 * 1024);
  if (!parsedBody.ok) return NextResponse.json({ message: parsedBody.message }, { status: parsedBody.status });
  const email = typeof parsedBody.data === "object" && parsedBody.data !== null && "email" in parsedBody.data && typeof parsedBody.data.email === "string"
    ? parsedBody.data.email.trim().toLowerCase().slice(0, 254) : "";
  try {
    const key = requestRateLimitKey(request, "register", email);
    if (!(await consumeRateLimit(key, 8, 60))) return NextResponse.json({ message: "Too many attempts. Please wait before trying again." }, { status: 429 });
    if (email && !(await consumeRateLimit(identifierRateLimitKey("email-verification-issue", email), 5, 3600))) {
      return NextResponse.json({ message: "Too many verification-code requests for this email. Please try again later." }, { status: 429 });
    }
  } catch { return NextResponse.json({ message: "Registration is temporarily unavailable." }, { status: 503 }); }
  try {
    const result = await registerAccount(parsedBody.data);
    return NextResponse.json({ message: result.message }, { status: result.ok ? 201 : result.status });
  } catch { return NextResponse.json({ message: "Unable to create the account right now." }, { status: 500 }); }
}
