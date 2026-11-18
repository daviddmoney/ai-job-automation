import { NextRequest, NextResponse } from "next/server";
import { handlers } from "@/auth";
import { consumeCredentialsLoginEndpointLimit, consumeOAuthInitiationEndpointLimit } from "@/lib/rate-limit";
import { createLoginRateLimitPass } from "@/lib/request-identity";

export const GET = handlers.GET;

export async function POST(request: NextRequest) {
  const url = new URL(request.url);
  if (url.pathname.endsWith("/signin/google")) {\n    try {\n      const limit = await consumeOAuthInitiationEndpointLimit(request);\n      if (!limit.identityVerified) return NextResponse.json({ message: "Sign-in is temporarily unavailable." }, { status: 503 });\n      if (!limit.allowed) return NextResponse.json({ message: "Too many sign-in attempts. Please wait before trying again." }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } });\n      return handlers.POST(request);\n    } catch {\n      return NextResponse.json({ message: "Sign-in is temporarily unavailable." }, { status: 503 });\n    }\n  }\n  if (!url.pathname.endsWith("/callback/credentials")) return handlers.POST(request);

  let email = "";
  try {
    const form = await request.clone().formData();
    email = String(form.get("email") ?? "").trim().toLowerCase().slice(0, 254);
  } catch {
    return NextResponse.json({ message: "Invalid sign-in request." }, { status: 400 });
  }

  try {
    const limit = await consumeCredentialsLoginEndpointLimit(request, email);
    if (!limit.identityVerified) {
      return NextResponse.json({ message: "Sign-in is temporarily unavailable." }, { status: 503 });
    }
    if (!limit.allowed) {
      return NextResponse.json(
        { message: "Too many sign-in attempts. Please wait before trying again." },
        { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
      );
    }

    // The signed, short-lived marker prevents authorize() from consuming the same
    // request twice. A caller cannot forge it without AUTH_SECRET.
    const headers = new Headers(request.headers);
    headers.set("x-internal-login-rate-limit-pass", createLoginRateLimitPass(email));
    return handlers.POST(new NextRequest(request, { headers }));
  } catch {
    return NextResponse.json({ message: "Sign-in is temporarily unavailable." }, { status: 503 });
  }
}
