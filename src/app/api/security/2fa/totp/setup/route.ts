import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { createTotpSecret, encryptTotpSecret, totpUri } from "@/lib/two-factor";

export const runtime = "nodejs";
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ message: "Sign in required." }, { status: 401 });
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { email: true } });
  if (!user?.email) return NextResponse.json({ message: "Account email unavailable." }, { status: 400 });
  try {
    const secret = createTotpSecret();
    await prisma.user.update({ where: { id: session.user.id }, data: { twoFactorPendingSecretCipher: encryptTotpSecret(secret) } });
    return NextResponse.json({ secret, otpauthUrl: totpUri(secret, user.email), message: "Add this account to an authenticator app, then confirm with the current six-digit code." });
  } catch { return NextResponse.json({ message: "Authenticator setup is not configured on the server." }, { status: 503 }); }
}
