import test from "node:test";
import assert from "node:assert/strict";
import { requestRateLimitKeys, verifiedClientIp } from "../src/lib/request-identity.ts";

const originalAuthSecret = process.env.AUTH_SECRET;
const originalProxySecret = process.env.TRUSTED_PROXY_HEADER_SECRET;
const authSecret = "test-auth-secret-that-is-at-least-thirty-two-characters";
const proxySecret = "test-proxy-secret-that-is-at-least-thirty-two-characters";

function request(ip, token = proxySecret, extra = {}) {
  return new Request("https://example.test/api/login", {
    headers: {
      "x-verified-client-ip": ip,
      "x-trusted-proxy-token": token,
      ...extra
    }
  });
}

test.after(() => {
  if (originalAuthSecret === undefined) delete process.env.AUTH_SECRET;
  else process.env.AUTH_SECRET = originalAuthSecret;
  if (originalProxySecret === undefined) delete process.env.TRUSTED_PROXY_HEADER_SECRET;
  else process.env.TRUSTED_PROXY_HEADER_SECRET = originalProxySecret;
});

test("trusted proxy token and valid IP are required before trusting client identity", () => {
  process.env.AUTH_SECRET = authSecret;
  process.env.TRUSTED_PROXY_HEADER_SECRET = proxySecret;
  assert.equal(verifiedClientIp(request("203.0.113.10")), "203.0.113.10");
  assert.equal(verifiedClientIp(request("203.0.113.10", "attacker-controlled-token")), "unknown");
  assert.equal(verifiedClientIp(request("not-an-ip")), "unknown");
  assert.equal(verifiedClientIp(new Request("https://example.test", {
    headers: { "x-forwarded-for": "203.0.113.10" }
  })), "unknown");
});

test("IP and account identities produce independent, privacy-preserving keys", () => {
  process.env.AUTH_SECRET = authSecret;
  process.env.TRUSTED_PROXY_HEADER_SECRET = proxySecret;
  const first = requestRateLimitKeys(request("203.0.113.10"), "login", "Alice@example.com");
  const otherAccount = requestRateLimitKeys(request("203.0.113.10"), "login", "bob@example.com");
  const otherIp = requestRateLimitKeys(request("203.0.113.11"), "login", "alice@example.com");

  assert.equal(first.ipKey, otherAccount.ipKey, "same IP shares the IP bucket");
  assert.notEqual(first.identifierKey, otherAccount.identifierKey, "different accounts have separate account buckets");
  assert.notEqual(first.ipKey, otherIp.ipKey, "different IPs have separate IP buckets");
  assert.equal(first.identifierKey, otherIp.identifierKey, "same account shares its account bucket across IPs");
  assert.ok(!first.ipKey.includes("203.0.113.10"));
  assert.ok(!first.identifierKey.includes("alice@example.com"));
});

test("missing or invalid trusted proxy identity fails closed instead of using a shared unknown bucket", () => {
  process.env.AUTH_SECRET = authSecret;
  process.env.TRUSTED_PROXY_HEADER_SECRET = proxySecret;
  assert.throws(
    () => requestRateLimitKeys(request("203.0.113.10", "wrong"), "login", "alice@example.com"),
    /TRUSTED_PROXY_IDENTITY_NOT_CONFIGURED/
  );
  delete process.env.TRUSTED_PROXY_HEADER_SECRET;
  assert.throws(
    () => requestRateLimitKeys(request("203.0.113.10"), "login", "alice@example.com"),
    /TRUSTED_PROXY_IDENTITY_NOT_CONFIGURED/
  );
});
