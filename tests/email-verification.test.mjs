import test from "node:test";
import assert from "node:assert/strict";
import {
  consumeEmailVerificationCode,
  emailVerificationCodeDigest
} from "../src/lib/email-verification.ts";

function mockDatabase(initial, clock = () => new Date()) {
  const state = { ...initial };
  let tail = Promise.resolve();
  const db = {
    state,
    async $queryRaw(strings, ...values) {
      const sql = strings.join("?");
      assert.match(sql, /CURRENT_TIMESTAMP/);
      assert.match(sql, /"emailVerificationAttempts" < 5/);
      const digest = values[0];
      const email = values[3];
      const run = async () => {
        if (state.email !== email || state.emailVerified || !state.hash ||
            !(state.expiresAt > clock()) || state.attempts >= 5) return [];
        if (state.hash === digest) {
          state.emailVerified = clock();
          state.hash = null;
          state.expiresAt = null;
          state.attempts = 0;
          return [{ verified: true }];
        }
        state.attempts += 1;
        return [{ verified: false }];
      };
      const result = tail.then(run, run);
      tail = result.then(() => undefined, () => undefined);
      return result;
    }
  };
  return db;
}

const digest = "a".repeat(64);
const validState = () => ({
  email: "otp-regression@example.test",
  emailVerified: null,
  hash: digest,
  expiresAt: new Date("2035-01-01T00:10:00.000Z"),
  attempts: 0
});
const fixedNow = () => new Date("2035-01-01T00:05:00.000Z");

test("valid unexpired OTP verifies successfully", async () => {
  const db = mockDatabase(validState(), fixedNow);
  assert.equal(await consumeEmailVerificationCode(db, db.state.email, digest), true);
  assert.ok(db.state.emailVerified);
  assert.equal(db.state.hash, null);
});

test("expired OTP is rejected using the database clock", async () => {
  const db = mockDatabase({ ...validState(), expiresAt: new Date("2035-01-01T00:04:59Z") }, fixedNow);
  assert.equal(await consumeEmailVerificationCode(db, db.state.email, digest), false);
  assert.equal(db.state.emailVerified, null);
});

test("a consumed OTP cannot be replayed", async () => {
  const db = mockDatabase(validState(), fixedNow);
  assert.equal(await consumeEmailVerificationCode(db, db.state.email, digest), true);
  assert.equal(await consumeEmailVerificationCode(db, db.state.email, digest), false);
});

test("concurrent verification of one OTP has exactly one winner", async () => {
  const db = mockDatabase(validState(), fixedNow);
  const results = await Promise.all(Array.from({ length: 20 }, () =>
    consumeEmailVerificationCode(db, db.state.email, digest)));
  assert.equal(results.filter(Boolean).length, 1);
});

test("incorrect submissions increment attempts consistently", async () => {
  const db = mockDatabase(validState(), fixedNow);
  for (let i = 0; i < 3; i++) {
    assert.equal(await consumeEmailVerificationCode(db, db.state.email, "b".repeat(64)), false);
  }
  assert.equal(db.state.attempts, 3);
});

test("the sixth incorrect attempt cannot pass the five-attempt limit", async () => {
  const db = mockDatabase(validState(), fixedNow);
  const results = await Promise.all(Array.from({ length: 12 }, () =>
    consumeEmailVerificationCode(db, db.state.email, "b".repeat(64))));
  assert.equal(results.filter(Boolean).length, 0);
  assert.equal(db.state.attempts, 5);
  assert.equal(await consumeEmailVerificationCode(db, db.state.email, digest), false);
});

test("concurrent incorrect submissions cannot bypass the limit", async () => {
  const db = mockDatabase({ ...validState(), attempts: 4 }, fixedNow);
  await Promise.all(Array.from({ length: 10 }, () =>
    consumeEmailVerificationCode(db, db.state.email, "c".repeat(64))));
  assert.equal(db.state.attempts, 5);
});

test("a newly issued digest invalidates the previously issued OTP", async () => {
  const db = mockDatabase({ ...validState(), hash: "d".repeat(64) }, fixedNow);
  assert.equal(await consumeEmailVerificationCode(db, db.state.email, digest), false);
  assert.equal(db.state.attempts, 1);
});

test("database errors propagate without a partial success response", async () => {
  const db = { $queryRaw: async () => { throw new Error("database unavailable"); } };
  await assert.rejects(
    consumeEmailVerificationCode(db, "otp-regression@example.test", digest),
    /database unavailable/
  );
});

test("OTP digests are keyed and reject a missing server secret", () => {
  const previous = process.env.AUTH_SECRET;
  try {
    delete process.env.AUTH_SECRET;
    assert.throws(() => emailVerificationCodeDigest("123456"), /AUTH_SECRET_NOT_CONFIGURED/);
    process.env.AUTH_SECRET = "test-only-secret-with-at-least-32-characters";
    assert.match(emailVerificationCodeDigest("123456"), /^[a-f0-9]{64}$/);
    assert.notEqual(emailVerificationCodeDigest("123456"), emailVerificationCodeDigest("123457"));
  } finally {
    if (previous === undefined) delete process.env.AUTH_SECRET;
    else process.env.AUTH_SECRET = previous;
  }
});
