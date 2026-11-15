import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { ingestJobWithLease } from "../src/lib/jobs/ingest.ts";

const prisma = new PrismaClient();

test("a reclaimed or expired job-sync lease cannot overwrite a posting", async () => {
  const suffix = randomUUID();
  const oldToken = randomUUID();
  const newToken = randomUUID();
  const task = await prisma.jobSyncTask.create({
    data: {
      dedupeKey: `lease-fence-test:${suffix}`,
      status: "PROCESSING",
      attempts: 1,
      lockToken: oldToken,
      lockedAt: new Date(),
      lockExpiresAt: new Date(Date.now() + 60_000)
    }
  });
  const jobInput = {
    source: "lease-fence-test",
    sourceJobId: suffix,
    title: "Original posting",
    company: "Example Employer",
    locationText: "Lagos, Nigeria",
    country: "Nigeria"
  };

  try {
    const first = await ingestJobWithLease(jobInput, { taskId: task.id, lockToken: oldToken }, { revalidate: false });
    assert.equal(first.outcome, "created");

    await prisma.jobSyncTask.update({
      where: { id: task.id },
      data: { lockToken: newToken, lockExpiresAt: new Date(Date.now() + 60_000) }
    });

    await assert.rejects(
      () => ingestJobWithLease({ ...jobInput, title: "Stale worker overwrite" }, { taskId: task.id, lockToken: oldToken }, { revalidate: false }),
      /JobSyncLeaseLost/
    );

    const afterReclaim = await prisma.jobPosting.findUnique({
      where: { source_sourceJobId: { source: jobInput.source, sourceJobId: suffix } }
    });
    assert.equal(afterReclaim?.title, "Original posting");

    await prisma.jobSyncTask.update({
      where: { id: task.id },
      data: { lockExpiresAt: new Date(Date.now() - 1) }
    });

    await assert.rejects(
      () => ingestJobWithLease({ ...jobInput, title: "Expired worker overwrite" }, { taskId: task.id, lockToken: newToken }, { revalidate: false }),
      /JobSyncLeaseLost/
    );

    const afterExpiry = await prisma.jobPosting.findUnique({
      where: { source_sourceJobId: { source: jobInput.source, sourceJobId: suffix } }
    });
    assert.equal(afterExpiry?.title, "Original posting");
  } finally {
    await prisma.jobPosting.deleteMany({ where: { source: jobInput.source, sourceJobId: suffix } });
    await prisma.jobSyncTask.delete({ where: { id: task.id } });
  }
});
