import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

test("email verification code can be consumed only once under concurrent requests", async () => {
  const suffix = randomUUID();
  const email = `otp-atomic-${suffix}@example.invalid`;
  const code = "482731";
  const authSecret = process.env.AUTH_SECRET ?? "integration-test-auth-secret-at-least-32-characters";
  const codeHash = createHash("sha256").update(`${authSecret}:${code}`).digest("hex");
  const user = await prisma.user.create({
    data: {
      email,
      emailVerificationCodeHash: codeHash,
      emailVerificationExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
      emailVerificationAttempts: 0
    }
  });

  const consumeCode = async () => prisma.user.updateMany({
    where: {
      email,
      emailVerified: null,
      emailVerificationCodeHash: codeHash,
      emailVerificationExpiresAt: { gt: new Date() },
      emailVerificationAttempts: { lt: 5 }
    },
    data: {
      emailVerified: new Date(),
      emailVerificationCodeHash: null,
      emailVerificationExpiresAt: null,
      emailVerificationAttempts: 0
    }
  });

  try {
    const results = await Promise.all([consumeCode(), consumeCode()]);
    assert.equal(results.reduce((total, result) => total + result.count, 0), 1);

    // A replay after successful consumption must not update the account.
    const replay = await consumeCode();
    assert.equal(replay.count, 0);

    const verified = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    assert.ok(verified.emailVerified);
    assert.equal(verified.emailVerificationCodeHash, null);
    assert.equal(verified.emailVerificationExpiresAt, null);
  } finally {
    await prisma.user.delete({ where: { id: user.id } });
  }
});
