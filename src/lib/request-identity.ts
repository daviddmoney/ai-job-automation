import { createHmac, timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";

/**
 * Only trust client IP metadata when the trusted edge overwrites both headers
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

/**
 * Produce independent keyed buckets for network identity and account identity.
 * In production, missing trusted proxy identity is a configuration failure:
 * do not collapse every visitor into a shared "unknown" IP bucket.
 */
export function requestRateLimitKeys(request: Request, scope: string, identifier = "") {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error("AUTH_SECRET_NOT_CONFIGURED");
  const ip = verifiedClientIp(request);
  if (ip === "unknown") throw new Error("TRUSTED_PROXY_IDENTITY_NOT_CONFIGURED");

  const key = (kind: string, value: string) =>
    createHmac("sha256", secret).update(`${scope}:${kind}:${value}`).digest("hex");

  const normalizedIdentifier = identifier.trim().toLowerCase();
  return {
    ipKey: key("ip", ip),
    identifierKey: normalizedIdentifier ? key("identifier", normalizedIdentifier) : null
  };
}
