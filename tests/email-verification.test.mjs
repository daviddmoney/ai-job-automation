import test from "node:test";
import assert from "node:assert/strict";
import { consumeEmailVerificationCode, createEmailVerificationExpiry } from "../src/lib/email-verification.ts";

class MemoryDatabase {
  constructor({ digest = "correct", expiresAt = new Date(Date.now() + 60_000), attempts = 0 } = {}) {
    this.state = { email: "otp@example.invalid", emailVerified: null, emailVerificationCodeHash: digest, emailVerificationExpiresAt: expiresAt, emailVerificationAttempts: attempts };
    this.calls = 0; this.failOnCall = null; this.queries = [];
  }
  async $queryRaw(strings, ...values) {
    this.calls += 1;
    const sql = strings.join("?");
    this.queries.push(sql);
    if (this.failOnCall === this.calls) throw new Error("simulated database failure");
    if (sql.includes("INTERVAL '10 minutes'")) {
      assert.match(sql, /clock_timestamp\(\)/);
      return [{ expiresAt: new Date(Date.now() + 10 * 60_000) }];
    }
    assert.match(sql, /clock_timestamp\(\)/, "expiry and verification timestamps must use PostgreSQL's live clock");
    const s = this.state;
    const email = values[0];
    const digest = values[1];
    assert.equal(email, s.email);
    if (sql.includes('SET\n      "emailVerified" = verification_time.now')) {
      if (s.emailVerified !== null || s.emailVerificationCodeHash !== digest
        || !(s.emailVerificationExpiresAt instanceof Date) || s.emailVerificationExpiresAt <= new Date()
        || s.emailVerificationAttempts >= 5) return [];
      s.emailVerified = new Date();
      s.emailVerificationCodeHash = null;
      s.emailVerificationExpiresAt = null;
      s.emailVerificationAttempts = 0;
      return [{ id: "user-1" }];
    }
    if (s.emailVerified === null && s.emailVerificationCodeHash !== digest
      && s.emailVerificationExpiresAt instanceof Date && s.emailVerificationExpiresAt > new Date()
      && s.emailVerificationAttempts < 5) {
      s.emailVerificationAttempts += 1;
    }
    return [];
  }
}
const consume = (database, digest = "correct") => consumeEmailVerificationCode(database, "otp@example.invalid", digest);

test("PostgreSQL generates the ten-minute expiry expression", async () => {
  const database = new MemoryDatabase();
  const expiresAt = await createEmailVerificationExpiry(database);
  assert.ok(expiresAt instanceof Date);
  assert.match(database.queries[0], /clock_timestamp\(\) \+ INTERVAL '10 minutes'/);
});
test("1. valid, unexpired OTP verifies and is consumed using the database clock", async () => {
  const database = new MemoryDatabase();
  assert.equal(await consume(database), true); assert.ok(database.state.emailVerified instanceof Date);
  assert.equal(database.state.emailVerificationCodeHash, null); assert.equal(database.state.emailVerificationExpiresAt, null);
  assert.equal(database.state.emailVerificationAttempts, 0);
});
test("2. expired OTP is rejected using PostgreSQL live time", async () => {
  const database = new MemoryDatabase({ expiresAt: new Date(Date.now() - 11 * 60_000) });
  assert.equal(await consume(database), false); assert.equal(database.state.emailVerified, null);
  assert.equal(database.state.emailVerificationAttempts, 0);
  assert.equal(database.queries.length, 2);
});
test("3. consumed OTP cannot be replayed", async () => {
  const database = new MemoryDatabase(); assert.equal(await consume(database), true);
  assert.equal(await consume(database), false); assert.ok(database.state.emailVerified instanceof Date);
});
test("4. simultaneous verification of one OTP has exactly one winner", async () => {
  const database = new MemoryDatabase();
  const results = await Promise.all(Array.from({ length: 12 }, () => consume(database)));
  assert.equal(results.filter(Boolean).length, 1); assert.ok(database.state.emailVerified instanceof Date);
});
test("5. each incorrect submission increments the attempt counter once", async () => {
  const database = new MemoryDatabase();
  for (let expected = 1; expected <= 3; expected += 1) {
    assert.equal(await consume(database, "wrong"), false); assert.equal(database.state.emailVerificationAttempts, expected);
  }
});
test("6. the sixth incorrect submission cannot bypass the five-attempt limit", async () => {
  const database = new MemoryDatabase();
  for (let i = 0; i < 6; i += 1) assert.equal(await consume(database, "wrong"), false);
  assert.equal(database.state.emailVerificationAttempts, 5); assert.equal(await consume(database), false);
  assert.equal(database.state.emailVerified, null);
});
test("7. concurrent incorrect submissions cannot exceed the five-attempt limit", async () => {
  const database = new MemoryDatabase();
  const results = await Promise.all(Array.from({ length: 20 }, () => consume(database, "wrong")));
  assert.ok(results.every(result => result === false)); assert.equal(database.state.emailVerificationAttempts, 5);
});
test("8. a newly issued OTP invalidates the previously issued OTP", async () => {
  const database = new MemoryDatabase({ digest: "old-digest" }); database.state.emailVerificationCodeHash = "new-digest";
  assert.equal(await consume(database, "old-digest"), false); assert.equal(await consume(database, "new-digest"), true);
});
test("9. database failure leaves the account unverified and OTP unconsumed", async () => {
  const database = new MemoryDatabase(); database.failOnCall = 1;
  await assert.rejects(() => consume(database), /simulated database failure/);
  assert.equal(database.state.emailVerified, null); assert.equal(database.state.emailVerificationCodeHash, "correct");
  assert.ok(database.state.emailVerificationExpiresAt instanceof Date); assert.equal(database.state.emailVerificationAttempts, 0);
});
