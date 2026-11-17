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


test("a worker waiting for the task-row lock cannot write after its lease expires", async () => {
  const suffix = randomUUID();
  const token = randomUUID();
  const expiresAt = new Date(Date.now() + 2_000);
  const task = await prisma.jobSyncTask.create({
    data: {
      dedupeKey: `lease-lock-wait-test:${suffix}`,
      status: "PROCESSING",
      attempts: 1,
      lockToken: token,
      lockedAt: new Date(),
      lockExpiresAt: expiresAt
    }
  });
  const jobInput = {
    source: "lease-lock-wait-test",
    sourceJobId: suffix,
    title: "Must not be written",
    company: "Example Employer",
    locationText: "Lagos, Nigeria",
    country: "Nigeria"
  };

  let signalLockHeld;
  const lockHeld = new Promise(resolve => { signalLockHeld = resolve; });
  let releaseLock;
  const lockRelease = new Promise(resolve => { releaseLock = resolve; });
  let lockTransaction;
  let pendingWrite;

  try {
    lockTransaction = prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT "id" FROM "JobSyncTask" WHERE "id" = ${task.id} FOR UPDATE`;
      signalLockHeld();
      await lockRelease;
    });
    await lockHeld;

    // Start the writer while the lease is valid. Its row-lock query must wait.
    pendingWrite = ingestJobWithLease(
      jobInput,
      { taskId: task.id, lockToken: token },
      { revalidate: false }
    );

    const deadline = Date.now() + 10_000;
    let isWaiting = false;
    while (Date.now() < deadline) {
      const rows = await prisma.$queryRaw`
        SELECT COUNT(*)::int AS "count"
        FROM pg_stat_activity
        WHERE datname = current_database()
          AND wait_event_type = 'Lock'
          AND query ILIKE '%JobSyncTask%'
      `;
      if (Number(rows[0]?.count ?? 0) > 0) {
        isWaiting = true;
        break;
      }
      await new Promise(resolve => setTimeout(resolve, 25));
    }
    assert.equal(isWaiting, true, "writer should be blocked on the task-row lock");

    // Keep the row lock until the lease has definitely expired.
    const remainingMs = Math.max(0, expiresAt.getTime() - Date.now() + 150);
    await prisma.$queryRaw`SELECT pg_sleep(${remainingMs / 1000}) IS NULL AS "slept"`;
    releaseLock();
    await lockTransaction;

    await assert.rejects(() => pendingWrite, /JobSyncLeaseLost/);
    const stored = await prisma.jobPosting.findUnique({
      where: { source_sourceJobId: { source: jobInput.source, sourceJobId: suffix } }
    });
    assert.equal(stored, null);
  } finally {
    releaseLock?.();
    if (lockTransaction) await lockTransaction.catch(() => {});
    if (pendingWrite) await pendingWrite.catch(() => {});
    await prisma.jobPosting.deleteMany({ where: { source: jobInput.source, sourceJobId: suffix } });
    await prisma.jobSyncTask.delete({ where: { id: task.id } });
  }
});
