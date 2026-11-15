import { createHmac, timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";
import { prisma } from "@/lib/prisma";

/**
 * Only trust client IP metadata when an edge proxy has overwritten
 * x-verified-client-ip and injected the matching shared secret. Never trust
 * arbitrary X-Forwarded-For / X-Real-IP values supplied by a client.
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

export function requestRateLimitKey(request: Request, scope: string, identifier = "") {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error("AUTH_SECRET_NOT_CONFIGURED");
  const ip = verifiedClientIp(request);
  return createHmac("sha256", secret).update(`${scope}:${ip}:${identifier.toLowerCase()}`).digest("hex");
}

/** Atomic PostgreSQL counter. The key is a keyed hash, not a raw IP or email address. */
export async function consumeRateLimit(key: string, limit: number, windowSeconds: number) {
  const resetAt = new Date(Date.now() + windowSeconds * 1000);
  const rows = await prisma.$queryRaw<Array<{ count: number }>>`
    INSERT INTO "RateLimitBucket" ("key", "count", "resetAt")
    VALUES (${key}, 1, ${resetAt})
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "RateLimitBucket"."resetAt" <= NOW() THEN 1 ELSE "RateLimitBucket"."count" + 1 END,
      "resetAt" = CASE WHEN "RateLimitBucket"."resetAt" <= NOW() THEN ${resetAt} ELSE "RateLimitBucket"."resetAt" END
    RETURNING "count"
  `;
  return (rows[0]?.count ?? limit + 1) <= limit;
}
