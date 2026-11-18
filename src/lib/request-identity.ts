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
  if (!secret || secret.length < 32 || !supplied || !candidate || isIP(candidate) === 0) return "unknown";
  const expected = Buffer.from(secret);
  const actual = Buffer.from(supplied);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return "unknown";
  return candidate.toLowerCase();
}

function rateLimitSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error("AUTH_SECRET_NOT_CONFIGURED");
  return secret;
}

/** IP + identifier limit; the identifier is never stored in plaintext. */
export function requestRateLimitKey(request: Request, scope: string, identifier = "") {
  const ip = verifiedClientIp(request);
  return createHmac("sha256", rateLimitSecret()).update(`${scope}:${ip}:${identifier.toLowerCase()}`).digest("hex");
}

/** Identifier-wide limit shared across IP addresses to stop distributed OTP re-issuance. */
export function identifierRateLimitKey(scope: string, identifier: string) {
  return createHmac("sha256", rateLimitSecret()).update(`${scope}:${identifier.trim().toLowerCase()}`).digest("hex");
}
