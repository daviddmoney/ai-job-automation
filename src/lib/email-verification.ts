type VerificationUserStore = {
  updateMany(args: {
    where: {
      email: string;
      emailVerified: null;
      emailVerificationCodeHash: string | { not: string };
      emailVerificationExpiresAt: { gt: Date };
      emailVerificationAttempts: { lt: number };
    };
    data: {
      emailVerified?: Date;
      emailVerificationCodeHash?: null;
      emailVerificationExpiresAt?: null;
      emailVerificationAttempts: number | { increment: number };
    };
  }): Promise<{ count: number }>;
};

/**
 * Atomically consumes a pending email verification code.
 * Returns true only for the single request that successfully claims it.
 */
export async function consumeEmailVerificationCode(
  user: VerificationUserStore,
  email: string,
  suppliedDigest: string
) {
  // This timestamp is generated inside the trusted server process. Never accept
  // an expiry timestamp from a browser, phone, or API request.
  const now = new Date();
  const verified = await user.updateMany({
    where: {
      email,
      emailVerified: null,
      emailVerificationCodeHash: suppliedDigest,
      emailVerificationExpiresAt: { gt: now },
      emailVerificationAttempts: { lt: 5 }
    },
    data: {
      emailVerified: now,
      emailVerificationCodeHash: null,
      emailVerificationExpiresAt: null,
      emailVerificationAttempts: 0
    }
  });

  if (verified.count === 1) return true;

  await user.updateMany({
    where: {
      email,
      emailVerified: null,
      emailVerificationCodeHash: { not: suppliedDigest },
      emailVerificationExpiresAt: { gt: now },
      emailVerificationAttempts: { lt: 5 }
    },
    data: { emailVerificationAttempts: { increment: 1 } }
  });

  return false;
}
