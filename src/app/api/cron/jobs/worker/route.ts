import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { syncJobSources } from "@/lib/jobs/sources/sync";
import { configuredJobAdapters } from "@/lib/jobs/sources/configured";
import {
  claimNextJobSyncTask,
  completeJobSyncTask,
  failJobSyncTask,
  renewJobSyncTaskLease
} from "@/lib/jobs/sources/queue";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  let task: Awaited<ReturnType<typeof claimNextJobSyncTask>>;
  try {
    task = await claimNextJobSyncTask();
  } catch {
    return NextResponse.json({ message: "Queue unavailable." }, { status: 503 });
  }

  if (!task) return NextResponse.json({ message: "No due job-sync tasks." }, { status: 200 });
  if (!task.lockToken) return NextResponse.json({ message: "Task lease could not be established." }, { status: 409 });

  let leaseLost = false;
  let renewalInFlight = false;
  const renewLease = async () => {
    if (leaseLost) return false;
    const renewed = await renewJobSyncTaskLease(task.id, task.lockToken!);
    if (renewed.count !== 1) leaseLost = true;
    return !leaseLost;
  };
  const assertLease = async () => {
    if (!(await renewLease())) throw new Error("JobSyncLeaseLost");
  };
  const heartbeat = setInterval(() => {
    if (leaseLost || renewalInFlight) return;
    renewalInFlight = true;
    void renewLease().catch(() => { leaseLost = true; }).finally(() => { renewalInFlight = false; });
  }, 30_000);
  heartbeat.unref?.();

  try {
    const adapters = configuredJobAdapters();
    if (adapters.length === 0) throw new Error("NoJobSourcesConfigured");

    const totals = await syncJobSources(
      adapters,
      new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      { beforeIngest: assertLease }
    );
    await assertLease();
    // Prisma's JSON input type requires JSON-compatible object index signatures.
    // Round-tripping through JSON validates and normalizes the persisted payload.
    const persistedTotals = JSON.parse(JSON.stringify(totals)) as Prisma.InputJsonValue;
    const completed = await completeJobSyncTask(task.id, task.lockToken, persistedTotals);
    if (completed.count !== 1) {
      return NextResponse.json({ message: "Task lease expired before completion." }, { status: 409 });
    }

    return NextResponse.json({ message: totals.sourceErrors > 0 ? "Job sync completed with provider or board failures recorded; successful boards were retained." : "Background job sync completed.", taskId: task.id, totals });
  } catch (error) {
    try {
      const updated = await failJobSyncTask(task.id, task.lockToken, task.attempts, error);
      if (updated.count !== 1) {
        return NextResponse.json({ message: "Task lease expired while recording failure." }, { status: 409 });
      }
    } catch {
      return NextResponse.json({ message: "Job sync failed and queue state could not be updated." }, { status: 503 });
    }

    return NextResponse.json({
      message: task.attempts >= 3 ? "Job sync failed after maximum attempts." : "Job sync failed and was scheduled for retry.",
      taskId: task.id
    }, { status: 502 });
  } finally {
    clearInterval(heartbeat);
  }
}
