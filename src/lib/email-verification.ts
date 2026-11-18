import { createHmac } from "node:crypto";

/**
 * A six-digit OTP has only one million possible values. Use a keyed digest
 * so a database-only disclosure cannot be brute-forced offline.
 */
export function emailVerificationCodeDigest(code: string): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SECRET_NOT_CONFIGURED");
  }
  return createHmac("sha256", secret).update(code, "utf8").digest("hex");
}

type RawQueryClient = {
  $queryRaw<T = unknown>(strings: TemplateStringsArray, ...values: unknown[]): Promise<T>;
};

/**
 * Atomically consumes a valid code or increments a failed attempt.
 * PostgreSQL's live clock is authoritative. The conditional UPDATE serializes
 * concurrent attempts on the user row and prevents replay or >5 attempts.
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
          THEN (clock_timestamp() AT TIME ZONE 'UTC')
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
      "updatedAt" = (clock_timestamp() AT TIME ZONE 'UTC')
    WHERE
      "email" = ${email}
      AND "emailVerified" IS NULL
      AND "emailVerificationCodeHash" IS NOT NULL
      AND "emailVerificationExpiresAt" > (clock_timestamp() AT TIME ZONE 'UTC')
      AND "emailVerificationAttempts" < 5
    RETURNING ("emailVerified" IS NOT NULL) AS verified
  `;

  return rows[0]?.verified === true;
}
