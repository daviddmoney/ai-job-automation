import { NextRequest, NextResponse } from "next/server";
import { configuredJobAdapters } from "@/lib/jobs/sources/configured";
import { enqueueJobSyncTask } from "@/lib/jobs/sources/queue";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  if (configuredJobAdapters().length === 0) {
    return NextResponse.json({ message: "No job-source adapters configured." }, { status: 503 });
  }

  try {
    const task = await enqueueJobSyncTask();
    return NextResponse.json({
      message: "Job synchronization queued for background processing.",
      task: { id: task.id, status: task.status, runAt: task.runAt }
    }, { status: 202 });
  } catch {
    return NextResponse.json({ message: "Unable to enqueue job synchronization." }, { status: 503 });
  }
}
