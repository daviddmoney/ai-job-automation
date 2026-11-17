import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import {
  consumeEmailVerificationCode,
  emailVerificationCodeDigest
} from "../src/lib/email-verification.ts";

const databaseUrl = process.env.DATABASE_URL;
test("PostgreSQL serializes concurrent OTP consumption and enforces expiry/attempt limits", {
  skip: !databaseUrl ? "DATABASE_URL is required for PostgreSQL integration tests" : false
}, async (t) => {
  const prisma = new PrismaClient();
  const secretWas = process.env.AUTH_SECRET;
  process.env.AUTH_SECRET = secretWas || "integration-test-secret-with-at-least-32-characters";
  const suffix = randomUUID();
  const email = `otp-${suffix}@example.test`;
  const validCode = "123456";
  const validDigest = emailVerificationCodeDigest(validCode);
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
        emailVerificationCodeHash: validDigest,
        emailVerificationExpiresAt: new Date(Date.now() - 1000)
      }
    });
    assert.equal(await consumeEmailVerificationCode(prisma, expiredEmail, validDigest), false);


    const resendEmail = `resend-${suffix}@example.test`;
    const oldDigest = emailVerificationCodeDigest("111111");
    const newDigest = emailVerificationCodeDigest("222222");
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
        emailVerificationCodeHash: validDigest,
        emailVerificationExpiresAt: new Date(Date.now() + 10 * 60 * 1000)
      }
    });
    await Promise.all(Array.from({ length: 12 }, () =>
      consumeEmailVerificationCode(prisma, attemptsEmail, "f".repeat(64))));
    const limited = await prisma.user.findUniqueOrThrow({ where: { email: attemptsEmail } });
    assert.equal(limited.emailVerificationAttempts, 5);
    assert.equal(await consumeEmailVerificationCode(prisma, attemptsEmail, validDigest), false);
  } finally {
    await prisma.user.deleteMany({ where: { email: { in: [email, `expired-${suffix}@example.test`, `attempts-${suffix}@example.test`, `resend-${suffix}@example.test`] } } });
    await prisma.$disconnect();
    if (secretWas === undefined) delete process.env.AUTH_SECRET;
    else process.env.AUTH_SECRET = secretWas;
  }
});
