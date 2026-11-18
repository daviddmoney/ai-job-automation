import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { consumeEmailSecondFactorCode, consumeEmailSecondFactorRecoveryCode, emailSecondFactorDigest } from "../src/lib/two-factor.ts";

const databaseUrl = process.env.DATABASE_URL;
const authSecret = process.env.AUTH_SECRET;

test("email second-factor OTP is atomic, single-use and capped at five failures", {
  skip: !databaseUrl || !authSecret ? "DATABASE_URL and AUTH_SECRET are required for PostgreSQL integration tests" : false
}, async () => {
  const prisma = new PrismaClient();
  const suffix = randomUUID();
  const email = `email-2fa-${suffix}@example.test`;
  const code = "654321";
  const digestFor = (value, userId, purpose = "login") => emailSecondFactorDigest(value, userId, purpose);
  try {
    const user = await prisma.user.create({
      data: {
        email,
        emailVerified: new Date(),
        twoFactorEnabled: true,
        twoFactorMethod: "EMAIL",
        twoFactorEmailCodeExpiresAt: new Date(Date.now() + 5 * 60 * 1000)
      }
    });
    const digest = digestFor(code, user.id);
    await prisma.user.update({ where: { id: user.id }, data: { twoFactorEmailCodeHash: digest } });
    const validResults = await Promise.all(Array.from({ length: 12 }, () =>
      consumeEmailSecondFactorCode(prisma, user.id, digest)));
    assert.equal(validResults.filter(Boolean).length, 1);
    const consumed = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    assert.equal(consumed.twoFactorEmailCodeHash, null);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        twoFactorEmailCodeHash: digestFor("111111", user.id),
        twoFactorEmailCodeExpiresAt: new Date(Date.now() + 5 * 60 * 1000),
        twoFactorEmailCodeAttempts: 0
      }
    });
    await Promise.all(Array.from({ length: 15 }, () =>
      consumeEmailSecondFactorCode(prisma, user.id, digestFor("222222", user.id))));
    const limited = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    assert.equal(limited.twoFactorEmailCodeAttempts, 5);
    assert.equal(await consumeEmailSecondFactorCode(prisma, user.id, digestFor("111111", user.id)), false);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        twoFactorEmailCodeHash: digestFor("333333", user.id),
        twoFactorEmailCodeExpiresAt: new Date(Date.now() - 1000),
        twoFactorEmailCodeAttempts: 0
      }
    });
    assert.equal(await consumeEmailSecondFactorCode(prisma, user.id, digestFor("333333", user.id)), false);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        twoFactorEnabled: true,
        twoFactorMethod: "TOTP",
        twoFactorEmailCodeHash: digestFor("444444", user.id),
        twoFactorEmailCodeExpiresAt: new Date(Date.now() + 5 * 60 * 1000),
        twoFactorEmailCodeAttempts: 0
      }
    });
    assert.equal(await consumeEmailSecondFactorCode(prisma, user.id, digestFor("444444", user.id)), false);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        twoFactorEnabled: false,
        twoFactorMethod: null,
        twoFactorEmailCodeHash: digestFor("555555", user.id, "activation"),
        twoFactorEmailCodeExpiresAt: new Date(Date.now() + 5 * 60 * 1000),
        twoFactorEmailCodeAttempts: 0
      }
    });
    assert.equal(await consumeEmailSecondFactorCode(prisma, user.id, digestFor("000000", user.id, "activation"), true), false);
    const stillDisabled = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    assert.equal(stillDisabled.twoFactorEnabled, false);
    assert.equal(stillDisabled.twoFactorMethod, null);
    assert.equal(await consumeEmailSecondFactorCode(prisma, user.id, digestFor("555555", user.id, "activation"), true), true);
    const activated = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    assert.equal(activated.twoFactorEnabled, true);
    assert.equal(activated.twoFactorMethod, "EMAIL");

    await prisma.user.update({
      where: { id: user.id },
      data: {
        twoFactorEnabled: true,
        twoFactorMethod: "TOTP",
        twoFactorSecretCipher: "test-cipher",
        twoFactorPendingSecretCipher: "test-pending-cipher",
        recoveryCodeHashes: ["previous-recovery-hash"],
        twoFactorLastTotpCounter: BigInt(123),
        twoFactorEmailCodeHash: digestFor("777777", user.id, "recovery"),
        twoFactorEmailCodeExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
        twoFactorEmailCodeAttempts: 0
      }
    });
    const recoveryDigest = digestFor("777777", user.id, "recovery");
    const recoveryResults = await Promise.all(Array.from({ length: 12 }, () =>
      consumeEmailSecondFactorRecoveryCode(prisma, user.id, recoveryDigest)));
    assert.equal(recoveryResults.filter(Boolean).length, 1);
    const recovered = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    assert.equal(recovered.twoFactorEnabled, false);
    assert.equal(recovered.twoFactorMethod, null);
    assert.equal(recovered.twoFactorSecretCipher, null);
    assert.equal(recovered.twoFactorPendingSecretCipher, null);
    assert.deepEqual(recovered.recoveryCodeHashes, []);
    assert.equal(recovered.twoFactorEmailCodeHash, null);
    assert.equal(recovered.twoFactorLastTotpCounter, null);
    assert.equal(recovered.sessionVersion, 2);
  } finally {
    await prisma.user.deleteMany({ where: { email } });
    await prisma.$disconnect();
  }
});
