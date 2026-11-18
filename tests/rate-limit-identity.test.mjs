import test from "node:test";
import assert from "node:assert/strict";
import {
  verifiedClientIp,
  requestIpRateLimitKey,
  requestAccountRateLimitKey,
  createLoginRateLimitPass,
  hasValidLoginRateLimitPass
} from "../src/lib/request-identity.ts";

test("unverified forwarding headers do not produce an IP rate-limit key", () => {
  const oldProxy = process.env.TRUSTED_PROXY_HEADER_SECRET;
  const oldAuth = process.env.AUTH_SECRET;
  process.env.TRUSTED_PROXY_HEADER_SECRET = "trusted-edge-test-secret-that-is-long-enough";
  process.env.AUTH_SECRET = "test-auth-secret-that-is-at-least-32-characters-long";
  try {
    const request = new Request("https://example.invalid/api", {
      headers: { "x-forwarded-for": "198.51.100.77", "x-real-ip": "198.51.100.77" }
    });
    assert.equal(verifiedClientIp(request), null);
    assert.equal(requestIpRateLimitKey(request, "login"), null);
  } finally {
    if (oldProxy === undefined) delete process.env.TRUSTED_PROXY_HEADER_SECRET;
    else process.env.TRUSTED_PROXY_HEADER_SECRET = oldProxy;
    if (oldAuth === undefined) delete process.env.AUTH_SECRET;
    else process.env.AUTH_SECRET = oldAuth;
  }
});

test("IP and account keys are independent, normalized, and opaque", () => {
  const oldProxy = process.env.TRUSTED_PROXY_HEADER_SECRET;
  const oldAuth = process.env.AUTH_SECRET;
  process.env.TRUSTED_PROXY_HEADER_SECRET = "trusted-edge-test-secret-that-is-long-enough";
  process.env.AUTH_SECRET = "test-auth-secret-that-is-at-least-32-characters-long";
  try {
    const request = new Request("https://example.invalid/api", {
      headers: {
        "x-verified-client-ip": "203.0.113.10",
        "x-trusted-proxy-token": process.env.TRUSTED_PROXY_HEADER_SECRET
      }
    });
    const ipKey = requestIpRateLimitKey(request, "login");
    const accountKey = requestAccountRateLimitKey("login", "User@Example.invalid");
    assert.ok(ipKey);
    assert.notEqual(ipKey, accountKey);
    assert.equal(accountKey, requestAccountRateLimitKey("login", "user@example.invalid"));
    assert.equal((ipKey + accountKey).includes("203.0.113.10"), false);
    assert.equal((ipKey + accountKey).includes("user@example.invalid"), false);
  } finally {
    if (oldProxy === undefined) delete process.env.TRUSTED_PROXY_HEADER_SECRET;
    else process.env.TRUSTED_PROXY_HEADER_SECRET = oldProxy;
    if (oldAuth === undefined) delete process.env.AUTH_SECRET;
    else process.env.AUTH_SECRET = oldAuth;
  }
});

test("login rate-limit pass is signed, nonce-bearing, and bound to the normalized account", () => {
  const oldAuth = process.env.AUTH_SECRET;
  process.env.AUTH_SECRET = "test-auth-secret-that-is-at-least-32-characters-long";
  try {
    const token = createLoginRateLimitPass("User@Example.invalid");
    const request = new Request("https://example.invalid/api", {
      headers: { "x-internal-login-rate-limit-pass": token }
    });
    assert.equal(token.split(".").length, 3);\n    assert.equal(hasValidLoginRateLimitPass(request, "user@example.invalid"), true);
    assert.equal(hasValidLoginRateLimitPass(request, "other@example.invalid"), false);
    const tampered = new Request("https://example.invalid/api", {
      headers: { "x-internal-login-rate-limit-pass": token.slice(0, -1) + "0" }
    });
    assert.equal(hasValidLoginRateLimitPass(tampered, "user@example.invalid"), false);
  } finally {
    if (oldAuth === undefined) delete process.env.AUTH_SECRET;
    else process.env.AUTH_SECRET = oldAuth;
  }
});
