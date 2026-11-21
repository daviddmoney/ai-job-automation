import { NextRequest, NextResponse } from "next/server";
import { registerAccount } from "@/lib/registration";
import { consumeIndependentRateLimits } from "@/lib/rate-limit";
import { readLimitedJson } from "@/lib/request-body";
import { isSameOriginRequest } from "@/lib/request-security";

export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ message: "Request rejected." }, { status: 403 });
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
    if (!result.ok && result.status === 400) {
      return NextResponse.json({ message: result.message }, { status: 400 });
    }
    // An existing verified account remains indistinguishable from a new one.
    // Infrastructure or email-delivery failures are different: return a generic
    // outage response so the user is not falsely told that processing succeeded.
    if (!result.ok && result.status === 503) {
      return NextResponse.json(
        { message: "Registration is temporarily unavailable. Please try again later." },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { message: "If the details can be used to create or verify an account, instructions will be sent to that email address." },
      { status: 202 }
    );
  } catch {
    return NextResponse.json(
      { message: "Registration is temporarily unavailable. Please try again later." },
      { status: 503 }
    );
  }
}
