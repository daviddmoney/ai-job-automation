import { createHmac, timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";

/**
 * Only trust client IP metadata when a trusted edge overwrites both headers
 * and injects the matching secret. Arbitrary forwarding headers are ignored.
 */
export function verifiedClientIp(request: Request) {
  const secret = process.env.TRUSTED_PROXY_HEADER_SECRET;
  const supplied = request.headers.get("x-trusted-proxy-token");
  const candidate = request.headers.get("x-verified-client-ip")?.trim();
  if (!secret || secret.length < 32 || !supplied || !candidate || isIP(candidate) === 0) return null;
  const expected = Buffer.from(secret);
  const actual = Buffer.from(supplied);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  return candidate.toLowerCase();
}

function hmacKey(value: string) {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error("AUTH_SECRET_NOT_CONFIGURED");
  return createHmac("sha256", secret).update(value).digest("hex");
}

/** Returns null unless the request carries a valid identity from the trusted edge. */
export function requestIpRateLimitKey(request: Request, scope: string) {
  const ip = verifiedClientIp(request);
  return ip ? hmacKey(`${scope}:ip:${ip}`) : null;
}

/** Stable per-account key, independent of the requesting IP address. */
export function requestAccountRateLimitKey(scope: string, identifier: string) {
  const normalized = identifier.trim().toLowerCase();
  if (!normalized) throw new Error("RATE_LIMIT_IDENTIFIER_REQUIRED");
  return hmacKey(`${scope}:account:${normalized}`);
}

/** Short-lived proof that the callback route already consumed both login buckets. */
export function createLoginRateLimitPass(identifier: string) {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error("AUTH_SECRET_NOT_CONFIGURED");
  const issuedAt = Date.now().toString();
  const normalized = identifier.trim().toLowerCase();
  const signature = createHmac("sha256", secret).update(`login-pass:${issuedAt}:${normalized}`).digest("hex");
  return `${issuedAt}.${signature}`;
}

export function hasValidLoginRateLimitPass(request: Request, identifier: string) {
  const token = request.headers.get("x-internal-login-rate-limit-pass");
  const secret = process.env.AUTH_SECRET;
  if (!token || !secret || secret.length < 32) return false;
  const [issuedAt, signature, extra] = token.split(".");
  if (!issuedAt || !signature || extra || !/^\d+$/.test(issuedAt)) return false;
  const timestamp = Number(issuedAt);
  if (!Number.isSafeInteger(timestamp) || Date.now() - timestamp < 0 || Date.now() - timestamp > 30_000) return false;
  const expected = createHmac("sha256", secret).update(`login-pass:${issuedAt}:${identifier.trim().toLowerCase()}`).digest("hex");
  const actualBytes = Buffer.from(signature, "hex");
  const expectedBytes = Buffer.from(expected, "hex");
  return actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes);
}

/** Backwards-compatible combined key for existing verification/resend routes. */
export function requestRateLimitKey(request: Request, scope: string, identifier = "") {
  const ip = verifiedClientIp(request) ?? "unverified";
  return hmacKey(`${scope}:${ip}:${identifier.toLowerCase()}`);
}
