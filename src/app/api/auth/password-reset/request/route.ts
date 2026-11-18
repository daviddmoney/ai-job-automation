import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isSameOriginRequest } from "@/lib/request-security";
import { readLimitedJson } from "@/lib/request-body";
import { consumeRateLimit, identifierRateLimitKey, requestRateLimitKey } from "@/lib/rate-limit";
import { passwordResetTokenDigest } from "@/lib/password-reset";
import { sendPasswordResetLink } from "@/lib/email";

export const runtime = "nodejs";
const genericMessage = "If a verified account matches that email, a password-reset link will be sent.";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ message: "Request rejected." }, { status: 403 });
  const body = await readLimitedJson(request, 4 * 1024);
  if (!body.ok) return NextResponse.json({ message: body.message }, { status: body.status });
  const parsed = z.object({ email: z.string().email().max(254) }).safeParse(body.data);
  if (!parsed.success) return NextResponse.json({ message: genericMessage });
  const email = parsed.data.email.trim().toLowerCase();

  try {
    if (!(await consumeRateLimit(requestRateLimitKey(request, "password-reset-request", email), 5, 3600))) {
      return NextResponse.json({ message: "Too many requests. Try again later." }, { status: 429 });
    }
    if (!(await consumeRateLimit(identifierRateLimitKey("password-reset-email", email), 3, 3600))) {
      return NextResponse.json({ message: "Too many requests. Try again later." }, { status: 429 });
    }
  } catch {
    return NextResponse.json({ message: "Password recovery is temporarily unavailable." }, { status: 503 });
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, emailVerified: true }
  });
  if (user?.emailVerified) {
    const rawToken = randomBytes(32).toString("base64url");
    const digest = passwordResetTokenDigest(rawToken);
    const identifier = `password-reset:${email}`;
    const expires = new Date(Date.now() + 15 * 60 * 1000);
    await prisma.$transaction(async (tx) => {
      await tx.verificationToken.deleteMany({ where: { identifier } });
      await tx.verificationToken.create({ data: { identifier, token: digest, expires } });
    });
    try {
      const baseUrl = process.env.AUTH_URL || new URL(request.url).origin;
      const url = new URL("/reset-password", baseUrl);
      url.searchParams.set("email", email);
      url.searchParams.set("token", rawToken);
      await sendPasswordResetLink(user.email, url.toString());
    } catch {
      await prisma.verificationToken.deleteMany({ where: { identifier, token: digest } });
      console.error(JSON.stringify({ event: "password_reset_email_delivery_failed" }));
    }
  }

  return NextResponse.json({ message: genericMessage });
}
