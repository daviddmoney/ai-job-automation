import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import {
  consumeEmailVerificationCode,
  emailVerificationCodeDigest
} from "../src/lib/email-verification.ts";

const prisma = new PrismaClient();

test("email verification code can be consumed only once under concurrent requests", async () => {
  const suffix = randomUUID();
  const email = `otp-atomic-${suffix}@example.invalid`;
  const code = "482731";
  const codeHash = emailVerificationCodeDigest(code);
  const user = await prisma.user.create({
    data: {
      email,
      emailVerificationCodeHash: codeHash,
      emailVerificationExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
      emailVerificationAttempts: 0
    }
  });

  const consumeCode = () => consumeEmailVerificationCode(prisma, email, codeHash);

  try {
    const results = await Promise.all([consumeCode(), consumeCode()]);
    assert.equal(results.filter(Boolean).length, 1);

    // A replay after successful consumption must not update the account.
    const replay = await consumeCode();
    assert.equal(replay, false);

    const verified = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    assert.ok(verified.emailVerified);
    assert.equal(verified.emailVerificationCodeHash, null);
    assert.equal(verified.emailVerificationExpiresAt, null);
  } finally {
    await prisma.user.delete({ where: { id: user.id } });
    await prisma.$disconnect();
  }
});
