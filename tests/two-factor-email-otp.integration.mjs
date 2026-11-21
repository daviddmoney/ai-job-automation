import test, { after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import {
  consumeEmailSecondFactorCode,
  consumeEmailSecondFactorRecoveryCode,
  issueEmailSecondFactorCode,
  emailSecondFactorDigest
} from "../src/lib/two-factor.ts";

const prisma = new PrismaClient();

after(async () => {
  await prisma.$disconnect();
});

async function withUser(run, overrides = {}) {
  const email = `two-factor-otp-${randomUUID()}@example.invalid`;
  const user = await prisma.user.create({
    data: {
      email,
      emailVerified: new Date(),
      twoFactorEnabled: true,
      twoFactorMethod: "EMAIL",
      ...overrides
    }
  });

  try {
    await run(user);
  } finally {
    await prisma.user.delete({ where: { id: user.id } });
  }
}

async function issue(user, code, purpose = "login", minutes = 5) {
  const digest = emailSecondFactorDigest(code, user.id, purpose);
  assert.equal(await issueEmailSecondFactorCode(prisma, user.id, digest, minutes, purpose), true);
  return digest;
}

test("email 2FA code uses PostgreSQL expiry and is consumed exactly once", async () =>
  withUser(async (user) => {
    const digest = await issue(user, "654321");
    const row = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    const [clock] = await prisma.$queryRaw`SELECT clock_timestamp() AS now`;
    assert.ok(row.twoFactorEmailCodeExpiresAt > clock.now);
    assert.ok(row.twoFactorEmailCodeExpiresAt <= new Date(clock.now.getTime() + 5 * 60_000));

    assert.equal(await consumeEmailSecondFactorCode(prisma, user.id, digest), true);
    assert.equal(await consumeEmailSecondFactorCode(prisma, user.id, digest), false);

    const consumed = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    assert.equal(consumed.twoFactorEmailCodeHash, null);
    assert.equal(consumed.twoFactorEmailCodeExpiresAt, null);
    assert.equal(consumed.twoFactorEmailCodeAttempts, 0);
  })
);

test("concurrent valid email 2FA submissions can succeed only once", async () =>
  withUser(async (user) => {
    const digest = await issue(user, "654321");
    const results = await Promise.all(
      Array.from({ length: 12 }, () => consumeEmailSecondFactorCode(prisma, user.id, digest))
    );
    assert.equal(results.filter(Boolean).length, 1);
  })
);

test("concurrent invalid email 2FA submissions stop at five attempts", async () =>
  withUser(async (user) => {
    await issue(user, "111111");
    const wrongDigest = emailSecondFactorDigest("222222", user.id);
    const results = await Promise.all(
      Array.from({ length: 20 }, () => consumeEmailSecondFactorCode(prisma, user.id, wrongDigest))
    );
    assert.ok(results.every((result) => result === false));
    const row = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    assert.equal(row.twoFactorEmailCodeAttempts, 5);
  })
);

test("expired email 2FA codes are rejected without consuming the code", async () =>
  withUser(async (user) => {
    const digest = await issue(user, "333333");
    await prisma.user.update({
      where: { id: user.id },
      data: { twoFactorEmailCodeExpiresAt: new Date(Date.now() - 1000) }
    });
    assert.equal(await consumeEmailSecondFactorCode(prisma, user.id, digest), false);
    const row = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    assert.equal(row.twoFactorEmailCodeHash, digest);
  })
);

test("email 2FA codes cannot be consumed after the active method changes", async () =>
  withUser(async (user) => {
    const digest = await issue(user, "444444");
    await prisma.user.update({ where: { id: user.id }, data: { twoFactorMethod: "TOTP" } });
    assert.equal(await consumeEmailSecondFactorCode(prisma, user.id, digest), false);
  })
);

test("purpose-bound activation OTP enables email 2FA only after valid confirmation", async () =>
  withUser(async (user) => {
    await prisma.user.update({
      where: { id: user.id },
      data: { twoFactorEnabled: false, twoFactorMethod: null }
    });
    const digest = await issue(user, "555555", "activation");
    const wrongDigest = emailSecondFactorDigest("000000", user.id, "activation");
    assert.equal(await consumeEmailSecondFactorCode(prisma, user.id, wrongDigest, true), false);

    const stillDisabled = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    assert.equal(stillDisabled.twoFactorEnabled, false);
    assert.equal(stillDisabled.twoFactorMethod, null);

    assert.equal(await consumeEmailSecondFactorCode(prisma, user.id, digest, true), true);
    const activated = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    assert.equal(activated.twoFactorEnabled, true);
    assert.equal(activated.twoFactorMethod, "EMAIL");
    assert.equal(activated.twoFactorEmailCodeHash, null);
    assert.equal(activated.sessionVersion, user.sessionVersion + 1);
  })
);

test("email fallback recovery atomically disables TOTP and revokes sessions", async () =>
  withUser(async (user) => {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        twoFactorEnabled: true,
        twoFactorMethod: "TOTP",
        twoFactorSecretCipher: "test-cipher",
        twoFactorPendingSecretCipher: "test-pending-cipher",
        recoveryCodeHashes: ["previous-recovery-hash"],
        twoFactorLastTotpCounter: BigInt(123)
      }
    });
    const digest = await issue(user, "777777", "recovery", 10);
    const results = await Promise.all(
      Array.from({ length: 12 }, () =>
        consumeEmailSecondFactorRecoveryCode(prisma, user.id, digest)
      )
    );
    assert.equal(results.filter(Boolean).length, 1);

    const recovered = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    assert.equal(recovered.twoFactorEnabled, false);
    assert.equal(recovered.twoFactorMethod, null);
    assert.equal(recovered.twoFactorSecretCipher, null);
    assert.equal(recovered.twoFactorPendingSecretCipher, null);
    assert.deepEqual(recovered.recoveryCodeHashes, []);
    assert.equal(recovered.twoFactorEmailCodeHash, null);
    assert.equal(recovered.twoFactorLastTotpCounter, null);
    assert.equal(recovered.sessionVersion, user.sessionVersion + 1);
  })
);

test("disable-purpose email OTP is distinct from a login-purpose OTP", async () =>
  withUser(async (user) => {
    const disableDigest = await issue(user, "888888", "disable");
    const loginDigest = emailSecondFactorDigest("888888", user.id, "login");
    assert.notEqual(disableDigest, loginDigest);
    assert.equal(await consumeEmailSecondFactorCode(prisma, user.id, loginDigest), false);
    assert.equal(await consumeEmailSecondFactorCode(prisma, user.id, disableDigest), true);
  })
);
