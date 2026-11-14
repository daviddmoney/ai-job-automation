import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { otpDigest } from "@/lib/two-factor";

export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ message: "Sign in required." }, { status: 401 });
  const body = await request.json().catch(() => null);
  const parsed = z.object({ code: z.string().regex(/^\d{6}$/) }).safeParse(body);
  if (!parsed.success) return NextResponse.json({ message: "Enter the six-digit code sent to your email." }, { status: 400 });
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { twoFactorEmailCodeHash: true, twoFactorEmailCodeExpiresAt: true, twoFactorEmailCodeAttempts: true } });
  if (!user?.twoFactorEmailCodeHash || !user.twoFactorEmailCodeExpiresAt || user.twoFactorEmailCodeExpiresAt < new Date() || user.twoFactorEmailCodeAttempts >= 5) return NextResponse.json({ message: "The code is invalid or expired." }, { status: 400 });
  if (otpDigest(parsed.data.code) !== user.twoFactorEmailCodeHash) { await prisma.user.update({ where: { id: session.user.id }, data: { twoFactorEmailCodeAttempts: { increment: 1 } } }); return NextResponse.json({ message: "The code is invalid or expired." }, { status: 400 }); }
  await prisma.user.update({ where: { id: session.user.id }, data: { twoFactorEnabled: true, twoFactorMethod: "EMAIL", twoFactorEmailCodeHash: null, twoFactorEmailCodeExpiresAt: null, twoFactorEmailCodeAttempts: 0 } });
  return NextResponse.json({ message: "Email two-factor authentication enabled." });
}
