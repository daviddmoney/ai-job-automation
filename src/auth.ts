import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { verify } from "argon2";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isSessionVersionCurrent } from "@/lib/session-security";
import { isVerifiedGoogleEmail } from "@/lib/oauth-security";
import { decryptTotpSecret, otpDigest, emailSecondFactorDigest, verifyTotpCounter, consumeEmailSecondFactorCode } from "@/lib/two-factor";
import { consumeRateLimit, identifierRateLimitKey, requestRateLimitKey, verifiedClientIp } from "@/lib/rate-limit";

const credentialsSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(1).max(256),
  secondFactorMethod: z.enum(["EMAIL", "TOTP"]).optional(),
  secondFactorCode: z.union([z.string().regex(/^[0-9]{6}$/), z.string().regex(/^[A-Fa-f0-9]{16}$/), z.literal("")]).optional()
});

const providers = [
  Credentials({
    name: "Email and password",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
      secondFactorMethod: { label: "Second-factor method", type: "text" },
      secondFactorCode: { label: "Second-factor code", type: "text" }
    },
    async authorize(rawCredentials, request) {
      const parsed = credentialsSchema.safeParse(rawCredentials);
      if (!parsed.success) return null;
      const email = parsed.data.email.trim().toLowerCase();
      try {
        // Apply independent account and trusted-client-IP limits. If the
        // trusted proxy identity is unavailable, never trust forwarding
        // headers or collapse every user's login attempts into one IP bucket;
        // the account-wide limiter remains active.
        const accountKey = identifierRateLimitKey("login-email", email);
        if (!(await consumeRateLimit(accountKey, 10, 900))) return null;
        if (verifiedClientIp(request) !== "unknown") {
          const ipKey = requestRateLimitKey(request, "login-ip");
          if (!(await consumeRateLimit(ipKey, 30, 900))) return null;
        }
      } catch { return null; }
      try {
        return await prisma.$transaction(async (tx) => {
          // Serialize password/second-factor verification with password resets,
          // factor changes and staff/session revocation updates.
          const locked = await tx.$queryRaw<Array<{ id: string }>>`
            SELECT "id" FROM "User" WHERE "email" = ${email} FOR UPDATE
          `;
          if (locked.length !== 1) return null;
          const user = await tx.user.findUnique({ where: { email } });
          if (!user?.passwordHash || !user.emailVerified) return null;
          try {
            if (!(await verify(user.passwordHash, parsed.data.password))) return null;
          } catch {
            return null;
          }

          if (user.twoFactorEnabled) {
            const code = parsed.data.secondFactorCode;
            if (!code || !parsed.data.secondFactorMethod || parsed.data.secondFactorMethod !== user.twoFactorMethod) return null;
            if (user.twoFactorMethod === "TOTP") {
              if (!user.twoFactorSecretCipher) return null;
              try {
                if (/^\\d{6}$/.test(code)) {
                  const counter = verifyTotpCounter(decryptTotpSecret(user.twoFactorSecretCipher), code);
                  if (counter === null) return null;
                  const consumed = await tx.user.updateMany({
                    where: {
                      id: user.id,
                      twoFactorEnabled: true,
                      twoFactorMethod: "TOTP",
                      twoFactorSecretCipher: user.twoFactorSecretCipher,
                      sessionVersion: user.sessionVersion,
                      OR: [{ twoFactorLastTotpCounter: null }, { twoFactorLastTotpCounter: { lt: BigInt(counter) } }]
                    },
                    data: { twoFactorLastTotpCounter: BigInt(counter) }
                  });
                  if (consumed.count !== 1) return null;
                } else {
                  const digest = otpDigest(code.toUpperCase());
                  const consumed = await tx.$executeRaw`
                    UPDATE "User"
                    SET "recoveryCodeHashes" = array_remove("recoveryCodeHashes", ${digest}),
                        "updatedAt" = (clock_timestamp() AT TIME ZONE 'UTC')
                    WHERE "id" = ${user.id}
                      AND "twoFactorEnabled" = TRUE
                      AND "twoFactorMethod" = 'TOTP'
                      AND "sessionVersion" = ${user.sessionVersion}
                      AND ${digest} = ANY("recoveryCodeHashes")
                  `;
                  if (consumed !== 1) return null;
                  await tx.auditEvent.create({
                    data: {
                      userId: user.id,
                      actorEmail: user.email ?? undefined,
                      action: "TOTP_RECOVERY_CODE_USED",
                      resource: "User",
                      resourceId: user.id
                    }
                  });
                }
              } catch {
                return null;
              }
            } else if (user.twoFactorMethod === "EMAIL") {
              if (!/^\\d{6}$/.test(code)) return null;
              try {
                if (!(await consumeEmailSecondFactorCode(tx, user.id, emailSecondFactorDigest(code, user.id)))) return null;
              } catch {
                return null;
              }
            }
          }
          return {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            sessionVersion: user.sessionVersion
          };
        });
      } catch {
        return null;
      }
    }
  }),
  ...(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET
    ? [Google({ clientId: process.env.AUTH_GOOGLE_ID, clientSecret: process.env.AUTH_GOOGLE_SECRET, allowDangerousEmailAccountLinking: false })]
    : [])
];

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers,
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 },
  useSecureCookies: process.env.NODE_ENV === "production",
  trustHost: true,
  pages: { signIn: "/signin" },
  callbacks: {
    async signIn({ user, account, profile }) {
      // Do not let an unverified Google address establish a verified app account.
      if (account?.provider === "google") {
        const googleProfile = profile as { email_verified?: unknown } | undefined;
        if (!isVerifiedGoogleEmail(googleProfile)) return false;
      }
      if (account?.provider !== "credentials" && user.email) {
        const existing = await prisma.user.findUnique({ where: { email: user.email.toLowerCase() }, select: { twoFactorEnabled: true, emailVerified: true } });
        if (existing?.twoFactorEnabled || (existing && !existing.emailVerified)) return false;
      }
      return true;
    },
    async jwt({ token, user }) {
      // Every session read checks the database-backed version. Missing or stale
      // versions revoke pre-upgrade tokens and tokens issued before a security
      // event (password reset, 2FA change, staff-role change).
      const userId = user?.id ?? token.sub;
      if (!userId) return token;
      try {
        const current = await prisma.user.findUnique({
          where: { id: userId },
          select: { id: true, role: true, sessionVersion: true }
        });
        if (!current ||
          (user && typeof user.sessionVersion === "number" && user.sessionVersion !== current.sessionVersion) ||
          (!user && !isSessionVersionCurrent(token.sessionVersion, current.sessionVersion))) {
          delete token.sub;
          delete token.role;
          delete token.sessionVersion;
          return token;
        }
        token.sub = current.id;
        token.role = current.role;
        token.sessionVersion = current.sessionVersion;
      } catch {
        // Fail closed when the session revocation state cannot be checked.
        delete token.sub;
        delete token.role;
        delete token.sessionVersion;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) { session.user.id = token.sub; session.user.role = token.role === "STAFF" ? "STAFF" : "USER"; }
      return session;
    }
  }
});
