import test, { after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import {
  consumeEmailSecondFactorCode,
  issueEmailTwoFactorCode,
  emailSecondFactorDigest
} from "../src/lib/two-factor.ts";

const prisma = new PrismaClient();

after(async () => {
  await prisma.$disconnect();
});

async function withUser(run) {
  const email = `two-factor-otp-${randomUUID()}@example.invalid`;
  const user = await prisma.user.create({
    data: {
      email,
      twoFactorEnabled: true,
      twoFactorMethod: "EMAIL"
    }
  });

  try {
    await run(user);
  } finally {
    await prisma.user.delete({ where: { id: user.id } });
  }
}

test("email 2FA code is issued with PostgreSQL time and consumed exactly once", async () =>
  withUser(async (user) => {
    const digest = emailSecondFactorDigest("654321", user.id);
    const expiry = await issueEmailTwoFactorCode(prisma, user.id, digest);

    assert.ok(expiry instanceof Date);

    const [clock] = await prisma.$queryRaw`SELECT clock_timestamp() AS now`;
    assert.ok(expiry > clock.now);
    assert.ok(expiry <= new Date(clock.now.getTime() + 5 * 60_000));

    assert.equal(await consumeEmailSecondFactorCode(prisma, user.id, digest), true);
    assert.equal(await consumeEmailSecondFactorCode(prisma, user.id, digest), false);

    const row = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    assert.equal(row.twoFactorEmailCodeHash, null);
    assert.equal(row.twoFactorEmailCodeExpiresAt, null);
    assert.equal(row.twoFactorEmailCodeAttempts, 0);
  })
);

test("concurrent valid email 2FA submissions can succeed only once", async () =>
  withUser(async (user) => {
    const digest = emailSecondFactorDigest("654321", user.id);
    await issueEmailTwoFactorCode(prisma, user.id, digest);

    const results = await Promise.all(
      Array.from({ length: 12 }, () =>
        consumeEmailSecondFactorCode(prisma, user.id, digest)
      )
    );

    assert.equal(results.filter(Boolean).length, 1);
  })
);

test("concurrent wrong email 2FA codes cannot exceed five attempts", async () =>
  withUser(async (user) => {
    await issueEmailTwoFactorCode(
      prisma,
      user.id,
      emailSecondFactorDigest("111111", user.id)
    );

    const results = await Promise.all(
      Array.from({ length: 20 }, () =>
        consumeEmailSecondFactorCode(
          prisma,
          user.id,
          emailSecondFactorDigest("222222", user.id)
        )
      )
    );

    assert.ok(results.every((result) => result === false));

    const row = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    assert.equal(row.twoFactorEmailCodeAttempts, 5);
  })
);

test("expired email 2FA codes are rejected", async () =>
  withUser(async (user) => {
    const digest = emailSecondFactorDigest("333333", user.id);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        twoFactorEmailCodeHash: digest,
        twoFactorEmailCodeExpiresAt: new Date(Date.now() - 1000),
        twoFactorEmailCodeAttempts: 0
      }
    });

    assert.equal(
      await consumeEmailSecondFactorCode(prisma, user.id, digest),
      false
    );
  })
);

test("email 2FA codes are rejected when the active method is not EMAIL", async () =>
  withUser(async (user) => {
    const digest = emailSecondFactorDigest("444444", user.id);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        twoFactorMethod: "TOTP",
        twoFactorEmailCodeHash: digest,
        twoFactorEmailCodeExpiresAt: new Date(Date.now() + 5 * 60 * 1000),
        twoFactorEmailCodeAttempts: 0
      }
    });

    assert.equal(
      await consumeEmailSecondFactorCode(prisma, user.id, digest),
      false
    );
  })
);

test("email 2FA setup activates only after successful code confirmation", async () =>
  withUser(async (user) => {
    const validDigest = emailSecondFactorDigest("555555", user.id);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        twoFactorEnabled: false,
        twoFactorMethod: null,
        twoFactorEmailCodeHash: validDigest,
        twoFactorEmailCodeExpiresAt: new Date(Date.now() + 5 * 60 * 1000),
        twoFactorEmailCodeAttempts: 0
      }
    });

    assert.equal(
      await consumeEmailSecondFactorCode(
        prisma,
        user.id,
        emailSecondFactorDigest("000000", user.id),
        true
      ),
      false
    );

    const stillDisabled = await prisma.user.findUniqueOrThrow({
      where: { id: user.id }
    });
    assert.equal(stillDisabled.twoFactorEnabled, false);
    assert.equal(stillDisabled.twoFactorMethod, null);

    assert.equal(
      await consumeEmailSecondFactorCode(prisma, user.id, validDigest, true),
      true
    );

    const activated = await prisma.user.findUniqueOrThrow({
      where: { id: user.id }
    });
    assert.equal(activated.twoFactorEnabled, true);
    assert.equal(activated.twoFactorMethod, "EMAIL");
  })
);
