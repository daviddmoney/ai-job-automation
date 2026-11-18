import { NextRequest, NextResponse } from "next/server";
import { registerAccount } from "@/lib/registration";
import { consumeIndependentRateLimits } from "@/lib/rate-limit";
import { readLimitedJson } from "@/lib/request-body";

export const runtime = "nodejs";
function sameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try { return new URL(origin).host === request.headers.get("host"); } catch { return false; }
}
const genericRegistrationMessage = "If the details can be used to create or verify an account, the website will guide you through the next step. For your security, we cannot confirm account status here. If you need a verification code, use the email verification page to request one.";

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ message: "Request rejected." }, { status: 403 });
  const parsedBody = await readLimitedJson(request, 16 * 1024);
  if (!parsedBody.ok) return NextResponse.json({ message: parsedBody.message }, { status: parsedBody.status });
  const email = typeof parsedBody.data === "object" && parsedBody.data !== null && "email" in parsedBody.data && typeof parsedBody.data.email === "string"
    ? parsedBody.data.email.trim().toLowerCase().slice(0, 254) : "";

  try {
    const limit = await consumeIndependentRateLimits(request, "register", email, 30, 5, 15 * 60);
    if (!limit.identityVerified) {
      return NextResponse.json({ message: "Registration is temporarily unavailable. Please try again later." }, { status: 503 });
    }
    if (!limit.allowed) {
      return NextResponse.json(
        { message: "Too many attempts. Please wait before trying again." },
        { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
      );
    }
  } catch {
    return NextResponse.json({ message: "Registration is temporarily unavailable." }, { status: 503 });
  }

  try {
    const result = await registerAccount(parsedBody.data);
    if (!result.ok && result.status === 400) return NextResponse.json({ message: result.message }, { status: 400 });
    // Keep the response identical for existing, new, and delivery-failure cases.
    return NextResponse.json({ message: genericRegistrationMessage }, { status: 202 });
  } catch {
    // Keep the public response indistinguishable from an existing-account response.
    return NextResponse.json({ message: genericRegistrationMessage }, { status: 202 });
  }
}
