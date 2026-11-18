import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { consumeEmailSecondFactorCode, emailSecondFactorDigest } from "../src/lib/two-factor.ts";

const databaseUrl = process.env.DATABASE_URL;
const authSecret = process.env.AUTH_SECRET;

test("email second-factor OTP is atomic, single-use and capped at five failures", {
  skip: !databaseUrl || !authSecret ? "DATABASE_URL and AUTH_SECRET are required for PostgreSQL integration tests" : false
}, async () => {
  const prisma = new PrismaClient();
  const suffix = randomUUID();
  const email = `email-2fa-${suffix}@example.test`;
  const code = "654321";
  const digest = emailSecondFactorDigest(code);
  try {
    const user = await prisma.user.create({
      data: {
        email,
        emailVerified: new Date(),
        twoFactorEnabled: true,
        twoFactorMethod: "EMAIL",
        twoFactorEmailCodeHash: digest,
        twoFactorEmailCodeExpiresAt: new Date(Date.now() + 5 * 60 * 1000)
      }
    });
    const validResults = await Promise.all(Array.from({ length: 12 }, () =>
      consumeEmailSecondFactorCode(prisma, user.id, digest)));
    assert.equal(validResults.filter(Boolean).length, 1);
    const consumed = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    assert.equal(consumed.twoFactorEmailCodeHash, null);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        twoFactorEmailCodeHash: emailSecondFactorDigest("111111"),
        twoFactorEmailCodeExpiresAt: new Date(Date.now() + 5 * 60 * 1000),
        twoFactorEmailCodeAttempts: 0
      }
    });
    await Promise.all(Array.from({ length: 15 }, () =>
      consumeEmailSecondFactorCode(prisma, user.id, emailSecondFactorDigest("222222"))));
    const limited = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    assert.equal(limited.twoFactorEmailCodeAttempts, 5);
    assert.equal(await consumeEmailSecondFactorCode(prisma, user.id, emailSecondFactorDigest("111111")), false);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        twoFactorEmailCodeHash: emailSecondFactorDigest("333333"),
        twoFactorEmailCodeExpiresAt: new Date(Date.now() - 1000),
        twoFactorEmailCodeAttempts: 0
      }
    });
    assert.equal(await consumeEmailSecondFactorCode(prisma, user.id, emailSecondFactorDigest("333333")), false);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        twoFactorEnabled: true,
        twoFactorMethod: "TOTP",
        twoFactorEmailCodeHash: emailSecondFactorDigest("444444"),
        twoFactorEmailCodeExpiresAt: new Date(Date.now() + 5 * 60 * 1000),
        twoFactorEmailCodeAttempts: 0
      }
    });
    assert.equal(await consumeEmailSecondFactorCode(prisma, user.id, emailSecondFactorDigest("444444")), false);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        twoFactorEnabled: false,
        twoFactorMethod: null,
        twoFactorEmailCodeHash: emailSecondFactorDigest("555555"),
        twoFactorEmailCodeExpiresAt: new Date(Date.now() + 5 * 60 * 1000),
        twoFactorEmailCodeAttempts: 0
      }
    });
    assert.equal(await consumeEmailSecondFactorCode(prisma, user.id, emailSecondFactorDigest("000000"), true), false);
    const stillDisabled = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    assert.equal(stillDisabled.twoFactorEnabled, false);
    assert.equal(stillDisabled.twoFactorMethod, null);
    assert.equal(await consumeEmailSecondFactorCode(prisma, user.id, emailSecondFactorDigest("555555"), true), true);
    const activated = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    assert.equal(activated.twoFactorEnabled, true);
    assert.equal(activated.twoFactorMethod, "EMAIL");
  } finally {
    await prisma.user.deleteMany({ where: { email } });
    await prisma.$disconnect();
  }
});
