import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { verify } from "argon2";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { decryptTotpSecret, otpDigest, verifyTotp } from "@/lib/two-factor";

const credentialsSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(1).max(256),
  secondFactorMethod: z.enum(["EMAIL", "TOTP"]).optional(),
  secondFactorCode: z.string().regex(/^\d{6}$/).optional()
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
    async authorize(rawCredentials) {
      const parsed = credentialsSchema.safeParse(rawCredentials);
      if (!parsed.success) return null;
      const email = parsed.data.email.trim().toLowerCase();
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user?.passwordHash || !user.emailVerified) return null;
      try { if (!(await verify(user.passwordHash, parsed.data.password))) return null; } catch { return null; }

      if (user.twoFactorEnabled) {
        const code = parsed.data.secondFactorCode;
        if (!code || !parsed.data.secondFactorMethod || parsed.data.secondFactorMethod !== user.twoFactorMethod) return null;
        if (user.twoFactorMethod === "TOTP") {
          if (!user.twoFactorSecretCipher) return null;
          try { if (!verifyTotp(decryptTotpSecret(user.twoFactorSecretCipher), code)) return null; } catch { return null; }
        } else if (user.twoFactorMethod === "EMAIL") {
          if (!user.twoFactorEmailCodeHash || !user.twoFactorEmailCodeExpiresAt || user.twoFactorEmailCodeExpiresAt < new Date() || user.twoFactorEmailCodeAttempts >= 5) return null;
          if (otpDigest(code) !== user.twoFactorEmailCodeHash) {
            await prisma.user.update({ where: { id: user.id }, data: { twoFactorEmailCodeAttempts: { increment: 1 } } });
            return null;
          }
          const consumed = await prisma.user.updateMany({ where: { id: user.id, twoFactorEmailCodeHash: user.twoFactorEmailCodeHash, twoFactorEmailCodeExpiresAt: { gt: new Date() }, twoFactorEmailCodeAttempts: { lt: 5 } }, data: { twoFactorEmailCodeHash: null, twoFactorEmailCodeExpiresAt: null, twoFactorEmailCodeAttempts: 0 } });
          if (consumed.count !== 1) return null;
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
    async signIn({ user, account }) {
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
