import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
test("saved jobs and applications remain isolated by userId", async () => {
 const suffix = randomUUID();
 const userA = await prisma.user.create({ data: { email: `isolation-a-${suffix}@example.invalid` } });
 const userB = await prisma.user.create({ data: { email: `isolation-b-${suffix}@example.invalid` } });
 const job = await prisma.jobPosting.create({ data: {
  source: "integration-test", sourceJobId: suffix, title: "Test Accountant",
  company: "Example Employer", locationText: "Lagos, Nigeria"
 } });
 try {
  await prisma.savedJob.create({ data: { userId: userA.id, jobPostingId: job.id } });
  await prisma.application.create({ data: {
   userId: userA.id, jobPostingId: job.id, company: job.company,
   jobTitle: job.title, workLocation: job.locationText
  } });
  const aSaved = await prisma.savedJob.findMany({ where: { userId: userA.id } });
  const bSaved = await prisma.savedJob.findMany({ where: { userId: userB.id } });
  const aApps = await prisma.application.findMany({ where: { userId: userA.id } });
  const bApps = await prisma.application.findMany({ where: { userId: userB.id } });
  assert.equal(aSaved.length, 1);
  assert.equal(aApps.length, 1);
  assert.equal(bSaved.length, 0);
  assert.equal(bApps.length, 0);
 } finally {
  await prisma.user.deleteMany({ where: { id: { in: [userA.id, userB.id] } } });
  await prisma.jobPosting.deleteMany({ where: { id: job.id } });
 }
});
