import { PrismaClient } from "@prisma/client";

const email = process.env.STAFF_EMAIL?.trim().toLowerCase();
const confirmed = process.env.CONFIRM_STAFF_PROMOTION === "YES";
if (!email || !confirmed) {
  console.error("Set STAFF_EMAIL to a verified account email and CONFIRM_STAFF_PROMOTION=YES to proceed.");
  process.exit(1);
}

const prisma = new PrismaClient();
try {
  const result = await prisma.user.updateMany({
    where: { email, emailVerified: { not: null } },
    data: { role: "STAFF" }
  });
  if (result.count !== 1) {
    console.error("No verified account matched. Register and verify the account before staff promotion.");
    process.exitCode = 1;
  } else {
    console.log("Verified account promoted to STAFF. Record this action in your administrative audit log.");
  }
} finally {
  await prisma.$disconnect();
}
