import { PrismaClient } from "@prisma/client";

const email = process.env.STAFF_EMAIL?.trim().toLowerCase();
const actorEmail = process.env.STAFF_PROMOTED_BY?.trim().toLowerCase();
const reason = process.env.STAFF_PROMOTION_REASON?.trim();
const confirmed = process.env.CONFIRM_STAFF_PROMOTION === "YES";

if (!email || !actorEmail || !reason || !confirmed) {
  console.error("Set STAFF_EMAIL, STAFF_PROMOTED_BY, STAFF_PROMOTION_REASON and CONFIRM_STAFF_PROMOTION=YES.");
  process.exit(1);
}

const prisma = new PrismaClient();
try {
  const promoted = await prisma.$transaction(async (tx) => {
    const target = await tx.user.findUnique({
      where: { email },
      select: { id: true, emailVerified: true, role: true }
    });
    if (!target?.emailVerified || target.role !== "USER") return false;

    const changed = await tx.user.updateMany({
      where: { id: target.id, emailVerified: { not: null }, role: "USER" },
      data: { role: "STAFF", sessionVersion: { increment: 1 } }
    });
    if (changed.count !== 1) return false;

    await tx.auditEvent.create({
      data: {
        userId: target.id,
        actorEmail,
        action: "STAFF_ROLE_GRANTED",
        resource: "User",
        resourceId: target.id,
        details: reason
      }
    });
    return true;
  });

  if (!promoted) {
    console.error("No verified USER account matched, or the account was already promoted.");
    process.exitCode = 1;
  } else {
    console.log("Verified account promoted to STAFF; the action was recorded in AuditEvent.");
  }
} finally {
  await prisma.$disconnect();
}
