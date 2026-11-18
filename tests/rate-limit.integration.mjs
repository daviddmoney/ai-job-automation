import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import {
  consumeIndependentRateLimits,
  consumeRateLimitWithInfo
} from "../src/lib/rate-limit.ts";
import {
  requestAccountRateLimitKey,
  requestIpRateLimitKey
} from "../src/lib/request-identity.ts";

const prisma = new PrismaClient();

function proxyRequest(ip) {
  return new Request("https://example.invalid/api", {
    headers: {
      "x-verified-client-ip": ip,
      "x-trusted-proxy-token": process.env.TRUSTED_PROXY_HEADER_SECRET
    }
  });
}

test("rate-limit counter enforces its threshold under concurrent requests", async () => {
  const key = `concurrent-test:${randomUUID()}`;
  try {
    const decisions = await Promise.all(
      Array.from({ length: 24 }, () => consumeRateLimitWithInfo(key, 7, 60))
    );
    assert.equal(decisions.filter(result => result.allowed).length, 7);
    assert.equal(decisions.filter(result => !result.allowed).length, 17);
    assert.ok(decisions.every(result => result.retryAfterSeconds >= 1));

    // An expired bucket must reset against PostgreSQL's current wall clock.
    await prisma.rateLimitBucket.update({
      where: { key },
      data: { resetAt: new Date(Date.now() - 1_000) }
    });
    const afterExpiry = await consumeRateLimitWithInfo(key, 7, 60);
    assert.equal(afterExpiry.allowed, true);
  } finally {
    await prisma.rateLimitBucket.deleteMany({ where: { key } });
  }
});

test("IP-wide limit is independent of account and enforced across concurrent requests", async () => {
  const previousProxy = process.env.TRUSTED_PROXY_HEADER_SECRET;
  const previousAuth = process.env.AUTH_SECRET;
  process.env.TRUSTED_PROXY_HEADER_SECRET = "integration-proxy-secret-long-enough-for-tests";
  process.env.AUTH_SECRET = "integration-auth-secret-long-enough-for-rate-limit-tests";
  const scope = `ip-concurrency:${randomUUID()}`;
  const request = proxyRequest("203.0.113.21");
  const ipKey = requestIpRateLimitKey(request, scope);
  const accountKeys = Array.from({ length: 12 }, (_, index) =>
    requestAccountRateLimitKey(scope, `user-${index}@example.invalid`)
  );

  try {
    const decisions = await Promise.all(
      Array.from({ length: 12 }, (_, index) =>
        consumeIndependentRateLimits(request, scope, `user-${index}@example.invalid`, 4, 20, 60)
      )
    );
    assert.ok(decisions.every(result => result.identityVerified));
    assert.equal(decisions.filter(result => result.allowed).length, 4);
    assert.equal(decisions.filter(result => !result.allowed).length, 8);
  } finally {
    await prisma.rateLimitBucket.deleteMany({ where: { key: { in: [ipKey, ...accountKeys].filter(Boolean) } } });
    if (previousProxy === undefined) delete process.env.TRUSTED_PROXY_HEADER_SECRET;
    else process.env.TRUSTED_PROXY_HEADER_SECRET = previousProxy;
    if (previousAuth === undefined) delete process.env.AUTH_SECRET;
    else process.env.AUTH_SECRET = previousAuth;
  }
});

test("account-wide limit applies across different verified IP addresses", async () => {
  const previousProxy = process.env.TRUSTED_PROXY_HEADER_SECRET;
  const previousAuth = process.env.AUTH_SECRET;
  process.env.TRUSTED_PROXY_HEADER_SECRET = "integration-proxy-secret-long-enough-for-tests";
  process.env.AUTH_SECRET = "integration-auth-secret-long-enough-for-rate-limit-tests";
  const scope = `account-concurrency:${randomUUID()}`;
  const email = `account-${randomUUID()}@example.invalid`;
  const accountKey = requestAccountRateLimitKey(scope, email);
  const requests = Array.from({ length: 8 }, (_, index) =>
    consumeIndependentRateLimits(
      proxyRequest(index % 2 === 0 ? "203.0.113.31" : "203.0.113.32"),
      scope,
      email,
      20,
      3,
      60
    )
  );

  try {
    const decisions = await Promise.all(requests);
    assert.ok(decisions.every(result => result.identityVerified));
    assert.equal(decisions.filter(result => result.allowed).length, 3);
    assert.equal(decisions.filter(result => !result.allowed).length, 5);
  } finally {
    const ipKeys = ["203.0.113.31", "203.0.113.32"].map(ip =>
      requestIpRateLimitKey(proxyRequest(ip), scope)
    ).filter(Boolean);
    await prisma.rateLimitBucket.deleteMany({ where: { key: { in: [...ipKeys, accountKey] } } });
    if (previousProxy === undefined) delete process.env.TRUSTED_PROXY_HEADER_SECRET;
    else process.env.TRUSTED_PROXY_HEADER_SECRET = previousProxy;
    if (previousAuth === undefined) delete process.env.AUTH_SECRET;
    else process.env.AUTH_SECRET = previousAuth;
  }
});

test("unverified proxy identity fails closed without consuming an unknown-IP bucket", async () => {
  const previousProxy = process.env.TRUSTED_PROXY_HEADER_SECRET;
  const previousAuth = process.env.AUTH_SECRET;
  process.env.TRUSTED_PROXY_HEADER_SECRET = "integration-proxy-secret-long-enough-for-tests";
  process.env.AUTH_SECRET = "integration-auth-secret-long-enough-for-rate-limit-tests";
  const request = new Request("https://example.invalid/api", {
    headers: { "x-forwarded-for": "198.51.100.99" }
  });

  try {
    const result = await consumeIndependentRateLimits(
      request,
      `unverified:${randomUUID()}`,
      "victim@example.invalid",
      10,
      5,
      60
    );
    assert.deepEqual(result, { allowed: false, retryAfterSeconds: 0, identityVerified: false });
  } finally {
    if (previousProxy === undefined) delete process.env.TRUSTED_PROXY_HEADER_SECRET;
    else process.env.TRUSTED_PROXY_HEADER_SECRET = previousProxy;
    if (previousAuth === undefined) delete process.env.AUTH_SECRET;
    else process.env.AUTH_SECRET = previousAuth;
  }
});

test("missing account identifiers still consume the verified IP bucket", async () => {
  const previousProxy = process.env.TRUSTED_PROXY_HEADER_SECRET;
  const previousAuth = process.env.AUTH_SECRET;
  process.env.TRUSTED_PROXY_HEADER_SECRET = "integration-proxy-secret-long-enough-for-tests";
  process.env.AUTH_SECRET = "integration-auth-secret-long-enough-for-rate-limit-tests";
  const scope = `invalid-identifier:${randomUUID()}`;
  const request = proxyRequest("203.0.113.41");
  const ipKey = requestIpRateLimitKey(request, scope);

  try {
    const decisions = await Promise.all(
      Array.from({ length: 6 }, () =>
        consumeIndependentRateLimits(request, scope, "", 2, 1, 60)
      )
    );
    assert.ok(decisions.every(result => result.identityVerified));
    assert.equal(decisions.filter(result => result.allowed).length, 2);
    assert.equal(decisions.filter(result => !result.allowed).length, 4);
  } finally {
    if (ipKey) await prisma.rateLimitBucket.deleteMany({ where: { key: ipKey } });
    if (previousProxy === undefined) delete process.env.TRUSTED_PROXY_HEADER_SECRET;
    else process.env.TRUSTED_PROXY_HEADER_SECRET = previousProxy;
    if (previousAuth === undefined) delete process.env.AUTH_SECRET;
    else process.env.AUTH_SECRET = previousAuth;
  }
});


test("credentials login endpoint gate blocks repeated requests after the account threshold", async () => {
  const previousProxy = process.env.TRUSTED_PROXY_HEADER_SECRET;
  const previousAuth = process.env.AUTH_SECRET;
  process.env.TRUSTED_PROXY_HEADER_SECRET = "integration-proxy-secret-long-enough-for-tests";
  process.env.AUTH_SECRET = "integration-auth-secret-long-enough-for-rate-limit-tests";
  const email = `repeat-${randomUUID()}@example.invalid`;
  const request = proxyRequest("203.0.113.51");
  const ipKey = requestIpRateLimitKey(request, "login");
  const accountKey = requestAccountRateLimitKey("login", email);
  try {
    const decisions = [];
    for (let index = 0; index < 12; index++) decisions.push(await consumeCredentialsLoginEndpointLimit(request, email));
    assert.equal(decisions.filter(result => result.allowed).length, 10);
    assert.equal(decisions.filter(result => !result.allowed).length, 2);
    assert.ok(decisions.every(result => result.identityVerified));
  } finally {
    await prisma.rateLimitBucket.deleteMany({ where: { key: { in: [ipKey, accountKey] } } });
    if (previousProxy === undefined) delete process.env.TRUSTED_PROXY_HEADER_SECRET;
    else process.env.TRUSTED_PROXY_HEADER_SECRET = previousProxy;
    if (previousAuth === undefined) delete process.env.AUTH_SECRET;
    else process.env.AUTH_SECRET = previousAuth;
  }
});

test("Google OAuth initiation endpoint gate blocks repeated requests from one IP", async () => {
  const previousProxy = process.env.TRUSTED_PROXY_HEADER_SECRET;
  const previousAuth = process.env.AUTH_SECRET;
  process.env.TRUSTED_PROXY_HEADER_SECRET = "integration-proxy-secret-long-enough-for-tests";
  process.env.AUTH_SECRET = "integration-auth-secret-long-enough-for-rate-limit-tests";
  const request = proxyRequest("203.0.113.52");
  const ipKey = requestIpRateLimitKey(request, "oauth-login");
  try {
    const decisions = [];
    for (let index = 0; index < 32; index++) decisions.push(await consumeOAuthInitiationEndpointLimit(request));
    assert.equal(decisions.filter(result => result.allowed).length, 30);
    assert.equal(decisions.filter(result => !result.allowed).length, 2);
    assert.ok(decisions.every(result => result.identityVerified));
  } finally {
    await prisma.rateLimitBucket.deleteMany({ where: { key: ipKey } });
    if (previousProxy === undefined) delete process.env.TRUSTED_PROXY_HEADER_SECRET;
    else process.env.TRUSTED_PROXY_HEADER_SECRET = previousProxy;
    if (previousAuth === undefined) delete process.env.AUTH_SECRET;
    else process.env.AUTH_SECRET = previousAuth;
  }
});

test("a signed credentials callback marker can be consumed once and cannot be replayed", async () => {
  const previousAuth = process.env.AUTH_SECRET;
  process.env.AUTH_SECRET = "integration-auth-secret-long-enough-for-rate-limit-tests";
  const email = `marker-${randomUUID()}@example.invalid`;
  const token = createLoginRateLimitPass(email);
  const request = new Request("https://example.invalid/api/auth/callback/credentials", {
    headers: { "x-internal-login-rate-limit-pass": token }
  });
  const key = loginRateLimitPassKey(request, email);
  try {
    assert.ok(key);
    assert.equal(await consumeLoginRateLimitPass(request, email), true);
    assert.equal(await consumeLoginRateLimitPass(request, email), false);
    assert.equal(await consumeLoginRateLimitPass(request, "other@example.invalid"), null);
  } finally {
    if (key) await prisma.rateLimitBucket.deleteMany({ where: { key } });
    if (previousAuth === undefined) delete process.env.AUTH_SECRET;
    else process.env.AUTH_SECRET = previousAuth;
  }
});
