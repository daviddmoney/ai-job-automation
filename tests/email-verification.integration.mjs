import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import {
  consumeEmailVerificationCode,
  emailVerificationCodeDigest
} from "../src/lib/email-verification.ts";

const databaseUrl = process.env.DATABASE_URL;
const authSecret = process.env.AUTH_SECRET;
test("PostgreSQL serializes concurrent OTP consumption and enforces expiry/attempt limits", {
  skip: !databaseUrl || !authSecret ? "DATABASE_URL and AUTH_SECRET are required for PostgreSQL integration tests" : false
}, async (t) => {
  const prisma = new PrismaClient();
  const suffix = randomUUID();
  const email = `otp-${suffix}@example.test`;
  const validCode = "123456";
  const validDigest = emailVerificationCodeDigest(validCode, email);
  try {
    const user = await prisma.user.create({
      data: {
        email,
        emailVerificationCodeHash: validDigest,
        emailVerificationExpiresAt: new Date(Date.now() + 10 * 60 * 1000)
      }
    });

    const results = await Promise.all(Array.from({ length: 16 }, () =>
      consumeEmailVerificationCode(prisma, email, validDigest)));
    assert.equal(results.filter(Boolean).length, 1);
    const verified = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    assert.ok(verified.emailVerified);
    assert.equal(verified.emailVerificationCodeHash, null);

    const expiredEmail = `expired-${suffix}@example.test`;
    await prisma.user.create({
      data: {
        email: expiredEmail,
        emailVerificationCodeHash: emailVerificationCodeDigest(validCode, expiredEmail),
        emailVerificationExpiresAt: new Date(Date.now() - 1000)
      }
    });
    assert.equal(await consumeEmailVerificationCode(prisma, expiredEmail, validDigest), false);

    const resendEmail = `resend-${suffix}@example.test`;
    const oldDigest = emailVerificationCodeDigest("111111", resendEmail);
    const newDigest = emailVerificationCodeDigest("222222", resendEmail);
    await prisma.user.create({
      data: {
        email: resendEmail,
        emailVerificationCodeHash: oldDigest,
        emailVerificationExpiresAt: new Date(Date.now() + 10 * 60 * 1000)
      }
    });
    await prisma.user.updateMany({
      where: { email: resendEmail, emailVerified: null },
      data: {
        emailVerificationCodeHash: newDigest,
        emailVerificationExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
        emailVerificationAttempts: 0
      }
    });
    assert.equal(await consumeEmailVerificationCode(prisma, resendEmail, oldDigest), false);
    assert.equal(await consumeEmailVerificationCode(prisma, resendEmail, newDigest), true);

    const attemptsEmail = `attempts-${suffix}@example.test`;
    await prisma.user.create({
      data: {
        email: attemptsEmail,
        emailVerificationCodeHash: emailVerificationCodeDigest(validCode, attemptsEmail),
        emailVerificationExpiresAt: new Date(Date.now() + 10 * 60 * 1000)
      }
    });
    await Promise.all(Array.from({ length: 12 }, () =>
      consumeEmailVerificationCode(prisma, attemptsEmail, "f".repeat(64))));
    const limited = await prisma.user.findUniqueOrThrow({ where: { email: attemptsEmail } });
    assert.equal(limited.emailVerificationAttempts, 5);
    assert.equal(await consumeEmailVerificationCode(prisma, attemptsEmail, emailVerificationCodeDigest(validCode, attemptsEmail)), false);
  } finally {
    await prisma.user.deleteMany({ where: { email: { in: [email, `expired-${suffix}@example.test`, `attempts-${suffix}@example.test`, `resend-${suffix}@example.test`] } } });
    await prisma.$disconnect();
  }
});
