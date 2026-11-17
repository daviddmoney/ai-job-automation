import { createHash } from "node:crypto";

/**
 * OTPs have only one million possible values, so their digest must be keyed.
 * AUTH_SECRET is server-only and must never be exposed to the browser.
 */
export function emailVerificationCodeDigest(code: string): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SECRET_NOT_CONFIGURED");
  }
  return createHash("sha256").update(`${secret}:${code}`).digest("hex");
}

type RawQueryClient = {
  $queryRaw<T = unknown>(strings: TemplateStringsArray, ...values: unknown[]): Promise<T>;
};

/**
 * Atomically consumes a valid code or increments a failed attempt.
 * PostgreSQL's clock is authoritative: no browser/device timestamp and no
 * application-side expiry comparison participates in acceptance.
 *
 * A single UPDATE serializes concurrent requests on the user row. Once one
 * request consumes the code, subsequent requests no longer match the WHERE.
 * Incorrect requests increment attempts only while fewer than five attempts
 * have been recorded.
 */
export async function consumeEmailVerificationCode(
  db: RawQueryClient,
  email: string,
  suppliedDigest: string
): Promise<boolean> {
  const rows = await db.$queryRaw<Array<{ verified: boolean }>>`
    UPDATE "User"
    SET
      "emailVerified" = CASE
        WHEN "emailVerificationCodeHash" = ${suppliedDigest}
          THEN clock_timestamp()
        ELSE "emailVerified"
      END,
      "emailVerificationCodeHash" = CASE
        WHEN "emailVerificationCodeHash" = ${suppliedDigest}
          THEN NULL
        ELSE "emailVerificationCodeHash"
      END,
      "emailVerificationExpiresAt" = CASE
        WHEN "emailVerificationCodeHash" = ${suppliedDigest}
          THEN NULL
        ELSE "emailVerificationExpiresAt"
      END,
      "emailVerificationAttempts" = CASE
        WHEN "emailVerificationCodeHash" = ${suppliedDigest}
          THEN 0
        ELSE "emailVerificationAttempts" + 1
      END,
      "updatedAt" = clock_timestamp()
    WHERE
      "email" = ${email}
      AND "emailVerified" IS NULL
      AND "emailVerificationCodeHash" IS NOT NULL
      AND "emailVerificationExpiresAt" > clock_timestamp()
      AND "emailVerificationAttempts" < 5
    RETURNING ("emailVerified" IS NOT NULL) AS verified
  `;

  return rows[0]?.verified === true;
}
