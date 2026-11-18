import { randomInt } from "node:crypto";
import { hash } from "argon2";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { sendVerificationCode } from "@/lib/email";
import { consumeEmailVerificationCode, emailVerificationCodeDigest, issueEmailVerificationCode } from "@/lib/email-verification";

const registrationSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(254),
  password: z.string().min(12).max(128)
    .regex(/[a-z]/, "Password must contain a lowercase letter")
    .regex(/[A-Z]/, "Password must contain an uppercase letter")
    .regex(/[0-9]/, "Password must contain a number")
});

export async function registerAccount(input: unknown) {
  const parsed = registrationSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, status: 400, message: "Please provide a valid name, email, and a password of at least 12 characters containing uppercase, lowercase, and numeric characters." };

  const email = parsed.data.email.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true, emailVerified: true } });
  if (existing?.emailVerified) return { ok: false as const, status: 409, message: "An account with this email already exists." };

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const codeHash = emailVerificationCodeDigest(code, email);
  const passwordHash = await hash(parsed.data.password, { type: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });

  let issuedUserId: string | null = null;
  try {
    issuedUserId = await prisma.$transaction(async (tx) => {
      let userId: string;
      if (existing) {
        userId = existing.id;
      } else {
        const created = await tx.user.create({
          data: { name: parsed.data.name, email, passwordHash, role: "USER" },
          select: { id: true }
        });
        userId = created.id;
      }
      const issued = await issueEmailVerificationCode(
        tx,
        userId,
        codeHash,
        existing ? { name: parsed.data.name, passwordHash } : undefined
      );
      return issued ? userId : null;
    });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      return { ok: false as const, status: 409, message: "An account with this email already exists." };
    }
    throw error;
  }
  if (!issuedUserId) {
    return { ok: false as const, status: 409, message: "An account with this email already exists." };
  }

  try {
    await sendVerificationCode(email, code);
  } catch {
    // A provider timeout may still have delivered the message. Invalidate only
    // this issuance, never a newer code created by a concurrent request.
    await prisma.user.updateMany({
      where: { email, emailVerified: null, emailVerificationCodeHash: codeHash },
      data: { emailVerificationCodeHash: null, emailVerificationExpiresAt: null }
    });
    return { ok: false as const, status: 503, message: "Your account details were saved, but email delivery is not configured or is temporarily unavailable. Please request a new code or contact the site administrator." };
  }
  return { ok: true as const, message: "Verification code sent. Check your email; the code expires in 10 minutes." };
}

export async function verifyAccountEmail(input: unknown) {
  const parsed = z.object({
    email: z.string().trim().email().max(254),
    code: z.string().regex(/^\d{6}$/)
  }).safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, status: 400, message: "Enter a valid email and six-digit verification code." };
  }

  const email = parsed.data.email.toLowerCase();
  const suppliedDigest = emailVerificationCodeDigest(parsed.data.code, email);
  const verified = await consumeEmailVerificationCode(prisma, email, suppliedDigest);

  return verified
    ? { ok: true as const, message: "Email verified. You can now sign in." }
    : { ok: false as const, status: 400, message: "The code is invalid or expired. Request a new code." };
}

export async function resendAccountVerification(input: unknown) {
  const parsed = z.object({ email: z.string().trim().email().max(254) }).safeParse(input);
  if (!parsed.success) return { ok: false as const, status: 400, message: "Enter a valid email address." };
  const email = parsed.data.email.toLowerCase();
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, emailVerified: true } });
  if (!user || user.emailVerified) return { ok: true as const, message: "If the account needs verification, a new code will be sent." };
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const codeHash = emailVerificationCodeDigest(code, email);
  const issued = await issueEmailVerificationCode(prisma, user.id, codeHash);
  if (!issued) return { ok: true as const, message: "If the account needs verification, a new code will be sent." };
  try {
    await sendVerificationCode(email, code);
  } catch {
    await prisma.user.updateMany({
      where: { id: user.id, emailVerified: null, emailVerificationCodeHash: codeHash },
      data: { emailVerificationCodeHash: null, emailVerificationExpiresAt: null }
    });
    return { ok: false as const, status: 503, message: "Email delivery is temporarily unavailable." };
  }
  return { ok: true as const, message: "If the account needs verification, a new code will be sent." };
}
