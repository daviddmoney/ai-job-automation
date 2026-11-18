import { NextResponse } from "next/server";
import { hash } from "argon2";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isSameOriginRequest } from "@/lib/request-security";
import { readLimitedJson } from "@/lib/request-body";
import { consumeRateLimit, requestRateLimitKey } from "@/lib/rate-limit";
import { passwordResetTokenDigest } from "@/lib/password-reset";

export const runtime = "nodejs";
const passwordSchema = z.string().min(12).max(256)
  .regex(/[A-Z]/, "Password must contain an uppercase letter")
  .regex(/[a-z]/, "Password must contain a lowercase letter")
  .regex(/[0-9]/, "Password must contain a number");

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ message: "Request rejected." }, { status: 403 });
  try {
    if (!(await consumeRateLimit(requestRateLimitKey(request, "password-reset-confirm"), 10, 3600))) {
      return NextResponse.json({ message: "Too many attempts. Try again later." }, { status: 429 });
    }
  } catch {
    return NextResponse.json({ message: "Password recovery is temporarily unavailable." }, { status: 503 });
  }
  const body = await readLimitedJson(request, 8 * 1024);
  if (!body.ok) return NextResponse.json({ message: body.message }, { status: body.status });
  const parsed = z.object({
    email: z.string().email().max(254),
    token: z.string().min(32).max(128),
    newPassword: passwordSchema
  }).safeParse(body.data);
  if (!parsed.success) return NextResponse.json({ message: "The reset link is invalid or expired, or the new password does not meet the requirements." }, { status: 400 });

  const email = parsed.data.email.trim().toLowerCase();
  const identifier = `password-reset:${email}`;
  const digest = passwordResetTokenDigest(parsed.data.token);
  const passwordHash = await hash(parsed.data.newPassword, { type: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  const reset = await prisma.$transaction(async (tx) => {
    const consumed = await tx.verificationToken.deleteMany({
      where: { identifier, token: digest, expires: { gt: new Date() } }
    });
    if (consumed.count !== 1) return false;
    const user = await tx.user.findUnique({ where: { email }, select: { id: true, emailVerified: true } });
    if (!user?.emailVerified) throw new Error("RESET_ACCOUNT_NOT_VERIFIED");
    await tx.user.update({
      where: { id: user.id },
      data: { passwordHash, sessionVersion: { increment: 1 } }
    });
    await tx.verificationToken.deleteMany({ where: { identifier } });
    await tx.auditEvent.create({
      data: {
        userId: user.id,
        actorEmail: email,
        action: "PASSWORD_RESET",
        resource: "User",
        resourceId: user.id
      }
    });
    return true;
  });

  if (!reset) return NextResponse.json({ message: "The reset link is invalid or expired." }, { status: 400 });
  return NextResponse.json({ message: "Your password has been reset. Sign in again with your new password." });
}
