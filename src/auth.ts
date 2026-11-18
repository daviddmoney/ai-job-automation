import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { verify } from "argon2";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { decryptTotpSecret, otpDigest, emailSecondFactorDigest, verifyTotpCounter, consumeEmailSecondFactorCode } from "@/lib/two-factor";
import { consumeCredentialsLoginEndpointLimit, consumeLoginRateLimitPass } from "@/lib/rate-limit";

class LoginRateLimitError extends CredentialsSignin { code = "rate_limited"; }

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
      const marker = await consumeLoginRateLimitPass(request, email).catch(() => null);
      if (marker === false) throw new LoginRateLimitError();
      if (marker === null) {
        let limit;
        try { limit = await consumeCredentialsLoginEndpointLimit(request, email); } catch { return null; }
        if (!limit.identityVerified) return null;
        if (!limit.allowed) throw new LoginRateLimitError();
      }
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user?.passwordHash || !user.emailVerified) return null;
      try { if (!(await verify(user.passwordHash, parsed.data.password))) return null; } catch { return null; }

      if (user.twoFactorEnabled) {
        const code = parsed.data.secondFactorCode;
        if (!code || !parsed.data.secondFactorMethod || parsed.data.secondFactorMethod !== user.twoFactorMethod) return null;
        if (user.twoFactorMethod === "TOTP") {
          if (!user.twoFactorSecretCipher) return null;
          try {
            if (/^\d{6}$/.test(code)) {
              const counter = verifyTotpCounter(decryptTotpSecret(user.twoFactorSecretCipher), code);
              if (counter === null) return null;
              const consumed = await prisma.user.updateMany({
                where: { id: user.id, twoFactorEnabled: true, twoFactorMethod: "TOTP", twoFactorSecretCipher: user.twoFactorSecretCipher, OR: [{ twoFactorLastTotpCounter: null }, { twoFactorLastTotpCounter: { lt: BigInt(counter) } }] },
                data: { twoFactorLastTotpCounter: BigInt(counter) }
              });
              if (consumed.count !== 1) return null;
            } else {
              const digest = otpDigest(code.toUpperCase());
              const consumed = await prisma.$executeRaw`UPDATE "User"
                SET "recoveryCodeHashes" = array_remove("recoveryCodeHashes", ${digest})
                WHERE "id" = ${user.id} AND "twoFactorEnabled" = TRUE AND "twoFactorMethod" = 'TOTP' AND ${digest} = ANY("recoveryCodeHashes")`;
              if (consumed !== 1) return null;
            }
          } catch { return null; }
        } else if (user.twoFactorMethod === "EMAIL") {
          if (!/^\d{6}$/.test(code)) return null;
          try {
            if (!(await consumeEmailSecondFactorCode(prisma, user.id, emailSecondFactorDigest(code, user.id)))) return null;
          } catch { return null; }
        }
      }
      return { id: user.id, name: user.name, email: user.email, role: user.role };
    }
  }),
  ...(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET
    ? [Google({ clientId: process.env.AUTH_GOOGLE_ID, clientSecret: process.env.AUTH_GOOGLE_SECRET })]
    : [])
];

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers,
  session: { strategy: "jwt" },
  pages: { signIn: "/signin" },
  callbacks: {
    async signIn({ user, account, profile }) {
      // Do not let an unverified Google address establish a verified app account.
      if (account?.provider === "google") {
        const googleProfile = profile as { email_verified?: unknown } | undefined;
        if (googleProfile?.email_verified !== true) return false;
      }
      if (account?.provider !== "credentials" && user.email) {
        const existing = await prisma.user.findUnique({ where: { email: user.email.toLowerCase() }, select: { twoFactorEnabled: true, emailVerified: true } });
        if (existing?.twoFactorEnabled || (existing && !existing.emailVerified)) return false;
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user) { token.sub = user.id; token.role = "role" in user ? user.role : "USER"; }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) { session.user.id = token.sub; session.user.role = token.role === "STAFF" ? "STAFF" : "USER"; }
      return session;
    }
  }
});
