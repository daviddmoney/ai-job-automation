import test, { after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { consumeEmailTwoFactorCode, issueEmailTwoFactorCode } from "../src/lib/two-factor.ts";

const prisma = new PrismaClient();
after(async () => { await prisma.$disconnect(); });

async function withUser(run) {
  const email = `two-factor-otp-${randomUUID()}@example.invalid`;
  const user = await prisma.user.create({ data: {
    email,
    twoFactorEnabled: true,
    twoFactorMethod: "EMAIL"
  }});
  try { await run(user); }
  finally { await prisma.user.delete({ where: { id: user.id } }); }
}

test("email 2FA code is issued with PostgreSQL time and consumed exactly once", async () => withUser(async (user) => {
  const expiry = await issueEmailTwoFactorCode(prisma, user.id, "valid-digest");
  assert.ok(expiry instanceof Date);
  const [clock] = await prisma.$queryRaw`SELECT clock_timestamp() AS now`;
  assert.ok(expiry > clock.now);
  assert.ok(expiry <= new Date(clock.now.getTime() + 5 * 60_000));
  assert.equal(await consumeEmailTwoFactorCode(prisma, user.id, "valid-digest"), true);
  assert.equal(await consumeEmailTwoFactorCode(prisma, user.id, "valid-digest"), false);
  const row = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
  assert.equal(row.twoFactorEmailCodeHash, null);
  assert.equal(row.twoFactorEmailCodeExpiresAt, null);
  assert.equal(row.twoFactorEmailCodeAttempts, 0);
}));

test("concurrent wrong email 2FA codes cannot exceed five attempts", async () => withUser(async (user) => {
  await issueEmailTwoFactorCode(prisma, user.id, "valid-digest");
  const results = await Promise.all(Array.from({ length: 20 }, () =>
    consumeEmailTwoFactorCode(prisma, user.id, "wrong-digest")
  ));
  assert.ok(results.every(result => result === false));
  const row = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
  assert.equal(row.twoFactorEmailCodeAttempts, 5);
}));
