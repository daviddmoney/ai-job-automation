import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const MAX_ATTEMPTS = 3;
const LEASE_MS = 5 * 60 * 1000;

export async function enqueueJobSyncTask() {
  const now = new Date();
  const hour = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    now.getUTCHours()
  ));
  const dedupeKey = `job-sync:${hour.toISOString()}`;

  return prisma.jobSyncTask.upsert({
    where: { dedupeKey },
    create: { dedupeKey, runAt: now },
    update: {}
  });
}

export async function claimNextJobSyncTask() {
  const now = new Date();
  const lockToken = randomUUID();

  return prisma.$transaction(async (tx) => {
    // Keep the queue table bounded without deleting pending or active work.
    await tx.jobSyncTask.deleteMany({
      where: { status: { in: ["COMPLETED", "FAILED"] }, updatedAt: { lt: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) } }
    });

    // A worker can disappear on its final attempt. Expired final leases must
    // be terminalized rather than remaining PROCESSING forever.
    await tx.jobSyncTask.updateMany({
      where: { status: "PROCESSING", attempts: { gte: MAX_ATTEMPTS }, lockExpiresAt: { lte: now } },
      data: { status: "FAILED", lockedAt: null, lockExpiresAt: null, lockToken: null, lastError: "LeaseExpiredAfterMaxAttempts" }
    });

    const candidate = await tx.jobSyncTask.findFirst({
      where: {
        attempts: { lt: MAX_ATTEMPTS },
        runAt: { lte: now },
        OR: [
          { status: "PENDING" },
          { status: "PROCESSING", lockExpiresAt: { lte: now } }
        ]
      },
      orderBy: [{ runAt: "asc" }, { createdAt: "asc" }]
    });

    if (!candidate) return null;

    const claimed = await tx.jobSyncTask.updateMany({
      where: {
        id: candidate.id,
        attempts: { lt: MAX_ATTEMPTS },
        OR: [
          { status: "PENDING" },
          { status: "PROCESSING", lockExpiresAt: { lte: now } }
        ]
      },
      data: {
        status: "PROCESSING",
        attempts: { increment: 1 },
        lockedAt: now,
        lockExpiresAt: new Date(now.getTime() + LEASE_MS),
        lockToken,
        lastError: null
      }
    });

    if (claimed.count !== 1) return null;
    return tx.jobSyncTask.findUnique({ where: { id: candidate.id } });
  });
}

export async function completeJobSyncTask(id: string, lockToken: string, result: Prisma.InputJsonValue) {
  return prisma.jobSyncTask.updateMany({
    where: { id, status: "PROCESSING", lockToken },
    data: {
      status: "COMPLETED",
      completedAt: new Date(),
      result,
      lockedAt: null,
      lockExpiresAt: null,
      lockToken: null,
      lastError: null
    }
  });
}

export async function failJobSyncTask(id: string, lockToken: string, attempts: number, error: unknown) {
  const exhausted = attempts >= MAX_ATTEMPTS;
  const retryDelayMs = Math.min(60_000 * 2 ** Math.max(0, attempts - 1), 15 * 60_000);

  return prisma.jobSyncTask.updateMany({
    where: { id, status: "PROCESSING", lockToken },
    data: {
      status: exhausted ? "FAILED" : "PENDING",
      runAt: exhausted ? new Date() : new Date(Date.now() + retryDelayMs),
      lockedAt: null,
      lockExpiresAt: null,
      lockToken: null,
      lastError: error instanceof Error ? error.name.slice(0, 120) : "UnknownError"
    }
  });
}
