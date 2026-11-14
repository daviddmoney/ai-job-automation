import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

/** Resolve identity from the Auth.js session, then read current role from the database. */
export async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { id: true, email: true, role: true, emailVerified: true } });
  if (!user || !user.emailVerified) redirect("/signin");
  return user;
}

/** Never rely on a role value submitted by the browser or a potentially stale JWT claim. */
export async function requireStaff() {
  const user = await requireUser();
  if (user.role !== "STAFF") redirect("/dashboard");
  return user;
}

/** Include both the resource ID and authenticated owner ID in every user-owned query. */
export function ownedRecordFilter(userId: string, resourceId: string) {
  return { id: resourceId, userId } as const;
}
