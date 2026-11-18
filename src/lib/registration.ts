import { createHash, randomInt } from "node:crypto";
import { hash } from "argon2";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { sendVerificationCode } from "@/lib/email";
import { consumeEmailVerificationCode, createEmailVerificationExpiry } from "@/lib/email-verification";

const registrationSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(254),
  password: z.string().min(12).max(128)
    .regex(/[a-z]/, "Password must contain a lowercase letter")
    .regex(/[A-Z]/, "Password must contain an uppercase letter")
    .regex(/[0-9]/, "Password must contain a number")
});

function codeDigest(code: string) {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error("AUTH_SECRET_NOT_CONFIGURED");
  return createHash("sha256").update(`${secret}:${code}`).digest("hex");
}

export async function registerAccount(input: unknown) {
  const parsed = registrationSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, status: 400, message: "Please provide a valid name, email, and a password of at least 12 characters containing uppercase, lowercase, and numeric characters." };

  const email = parsed.data.email.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true, emailVerified: true } });
  if (existing?.emailVerified) return { ok: false as const, status: 409, message: "An account with this email already exists." };

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const digest = codeDigest(code);
  const passwordHash = await hash(parsed.data.password, { type: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });

  const user = await prisma.$transaction(async (transaction) => {
    const expiresAt = await createEmailVerificationExpiry(transaction);
    return existing
      ? transaction.user.update({ where: { id: existing.id }, data: { name: parsed.data.name, passwordHash, emailVerificationCodeHash: digest, emailVerificationExpiresAt: expiresAt, emailVerificationAttempts: 0 } })
      : transaction.user.create({ data: { name: parsed.data.name, email, passwordHash, role: "USER", emailVerificationCodeHash: digest, emailVerificationExpiresAt: expiresAt, emailVerificationAttempts: 0 } });
  });

  try {
    await sendVerificationCode(user.email, code);
  } catch {
    return { ok: false as const, status: 503, message: "Your account details were saved, but email delivery is not configured or is temporarily unavailable. Please contact the site administrator before trying again." };
  }
  return { ok: true as const, message: "Verification code sent. Check your email; the code expires in 10 minutes." };
}

export async function verifyAccountEmail(input: unknown) {
  const parsed = z.object({ email: z.string().email().max(254), code: z.string().regex(/^\\d{6}$/) }).safeParse(input);
  if (!parsed.success) return { ok: false as const, status: 400, message: "Enter a valid email and six-digit verification code." };

  const email = parsed.data.email.trim().toLowerCase();
  const supplied = codeDigest(parsed.data.code);
  const verified = await consumeEmailVerificationCode(prisma, email, supplied);

  if (verified) {
    return { ok: true as const, message: "Email verified. You can now sign in." };
  }

  return { ok: false as const, status: 400, message: "The code is invalid or expired. Request a new code." };
}

export async function resendAccountVerification(input: unknown) {
  const parsed = z.object({ email: z.string().trim().email().max(254) }).safeParse(input);
  if (!parsed.success) return { ok: false as const, status: 400, message: "Enter a valid email address." };
  const user = await prisma.user.findUnique({ where: { email: parsed.data.email.toLowerCase() } });
  if (!user || user.emailVerified) return { ok: true as const, message: "If the account needs verification, a new code will be sent." };

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const digest = codeDigest(code);
  await prisma.$transaction(async (transaction) => {
    const expiresAt = await createEmailVerificationExpiry(transaction);
    await transaction.user.update({ where: { id: user.id }, data: { emailVerificationCodeHash: digest, emailVerificationExpiresAt: expiresAt, emailVerificationAttempts: 0 } });
  });

  try { await sendVerificationCode(user.email, code); }
  catch { return { ok: false as const, status: 503, message: "Email delivery is temporarily unavailable." }; }
  return { ok: true as const, message: "If the account needs verification, a new code will be sent." };
}
