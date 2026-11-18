import { createHmac } from "node:crypto";

type VerificationDatabase = {
  $queryRaw<T = unknown>(
    query: TemplateStringsArray,
    ...values: unknown[]
  ): Promise<T>;
};

/**
 * OTPs have only one million possible values, so their digest must be keyed.
 */
export function emailVerificationCodeDigest(code: string, email: string): string {
  const secret = process.env.AUTH_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SECRET_NOT_CONFIGURED");
  }

  return createHmac("sha256", secret).update(`email-verification:v1:${email.trim().toLowerCase()}:${code}`, "utf8").digest("hex");
}

/** Generate the ten-minute OTP expiry using PostgreSQL's live clock. */
export async function createEmailVerificationExpiry(
  database: VerificationDatabase
) {
  const rows = await database.$queryRaw<Array<{ expiresAt: Date }>>`
    SELECT clock_timestamp() + INTERVAL '10 minutes' AS "expiresAt"
  `;

  if (rows.length !== 1 || !(rows[0].expiresAt instanceof Date)) {
    throw new Error("EMAIL_VERIFICATION_EXPIRY_UNAVAILABLE");
  }

  return rows[0].expiresAt;
}

/**
 * Atomically consumes a pending email verification code.
 * PostgreSQL's live clock is authoritative for expiry and verification.
 */
export async function consumeEmailVerificationCode(
  database: VerificationDatabase,
  email: string,
  suppliedDigest: string
): Promise<boolean> {
  const verified = await database.$queryRaw<Array<{ id: string }>>`
    WITH verification_time AS (
      SELECT clock_timestamp() AS now
    )
    UPDATE "User" AS account
    SET
      "emailVerified" = verification_time.now,
      "emailVerificationCodeHash" = NULL,
      "emailVerificationExpiresAt" = NULL,
      "emailVerificationAttempts" = 0,
      "updatedAt" = clock_timestamp()
    FROM verification_time
    WHERE
      account."email" = ${email}
      AND account."emailVerified" IS NULL
      AND account."emailVerificationCodeHash" = ${suppliedDigest}
      AND account."emailVerificationExpiresAt" > verification_time.now
      AND account."emailVerificationAttempts" < 5
    RETURNING account."id"
  `;

  if (verified.length === 1) {
    return true;
  }

  // Charge an incorrect attempt only while the OTP is live and unconsumed.
  await database.$queryRaw<Array<{ id: string }>>`
    WITH verification_time AS (
      SELECT clock_timestamp() AS now
    )
    UPDATE "User" AS account
    SET
      "emailVerificationAttempts" = account."emailVerificationAttempts" + 1,
      "updatedAt" = clock_timestamp()
    FROM verification_time
    WHERE
      account."email" = ${email}
      AND account."emailVerified" IS NULL
      AND account."emailVerificationCodeHash" IS NOT NULL
      AND account."emailVerificationCodeHash" IS DISTINCT FROM ${suppliedDigest}
      AND account."emailVerificationExpiresAt" > verification_time.now
      AND account."emailVerificationAttempts" < 5
    RETURNING account."id"
  `;

  return false;
}

/** Issue or replace a verification OTP using PostgreSQL's live clock. */
export async function issueEmailVerificationCode(
  db: RawQueryClient,
  userId: string,
  digest: string,
  profile?: { name?: string; passwordHash?: string }
): Promise<boolean> {
  const name = profile?.name ?? null;
  const passwordHash = profile?.passwordHash ?? null;
  const rows = await db.$queryRaw<Array<{ id: string }>>`
    UPDATE "User"
    SET
      "name" = COALESCE(${name}, "name"),
      "passwordHash" = COALESCE(${passwordHash}, "passwordHash"),
      "emailVerificationCodeHash" = ${digest},
      "emailVerificationExpiresAt" = (clock_timestamp() AT TIME ZONE 'UTC') + INTERVAL '10 minutes',
      "emailVerificationAttempts" = 0,
      "updatedAt" = (clock_timestamp() AT TIME ZONE 'UTC')
    WHERE "id" = ${userId}
      AND "emailVerified" IS NULL
    RETURNING "id"
  `;
  return rows.length === 1;
}
