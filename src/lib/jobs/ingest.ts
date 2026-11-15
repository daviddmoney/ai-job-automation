import { z } from "zod";
import { revalidateTag } from "next/cache";
import { JobPostingStatus, JobWorkMode } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const optionalUrl = z.string().url().max(2048).refine(value => ["http:", "https:"].includes(new URL(value).protocol)).nullable().optional();
export const incomingJobSchema = z.object({
  source: z.string().trim().min(2).max(80),
  sourceJobId: z.string().trim().min(1).max(256),
  title: z.string().trim().min(2).max(250),
  company: z.string().trim().min(1).max(250),
  salaryText: z.string().trim().max(150).nullable().optional(),
  employmentType: z.string().trim().max(100).nullable().optional(),
  jobCategory: z.string().trim().max(120).nullable().optional(),
  description: z.string().max(30000).nullable().optional(),
  sourceLanguage: z.string().trim().max(20).nullable().optional(),
  applicationUrl: optionalUrl,
  sourceUrl: optionalUrl,
  locationText: z.string().trim().min(2).max(500),
  city: z.string().trim().max(100).nullable().optional(),
  state: z.string().trim().max(100).nullable().optional(),
  country: z.string().trim().max(100).nullable().optional(),
  workMode: z.nativeEnum(JobWorkMode).default(JobWorkMode.ONSITE),
  eligibleLocations: z.array(z.string().trim().min(1).max(150)).max(100).default([]),
  publishedAt: z.string().datetime().nullable().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  status: z.nativeEnum(JobPostingStatus).default(JobPostingStatus.ACTIVE)
});

export async function ingestJob(input: unknown) {
  const parsed = incomingJobSchema.safeParse(input);
  if (!parsed.success) return { outcome: "invalid" as const };
  const job = parsed.data;
  const existing = await prisma.jobPosting.findUnique({
    where: { source_sourceJobId: { source: job.source, sourceJobId: job.sourceJobId } },
    select: { id: true, status: true }
  });
  const data = {
    title: job.title,
    company: job.company,
    salaryText: job.salaryText ?? null,
    employmentType: job.employmentType ?? null,
    jobCategory: job.jobCategory ?? null,
    description: job.description ?? null,
    sourceLanguage: job.sourceLanguage ?? null,
    applicationUrl: job.applicationUrl ?? null,
    sourceUrl: job.sourceUrl ?? null,
    locationText: job.locationText,
    city: job.city ?? null,
    state: job.state ?? null,
    country: job.country ?? null,
    workMode: job.workMode,
    eligibleLocations: job.eligibleLocations,
    publishedAt: job.publishedAt ? new Date(job.publishedAt) : null,
    expiresAt: job.expiresAt ? new Date(job.expiresAt) : null,
    status: job.status,
    ...(existing?.status === "CLOSED" && job.status === "ACTIVE" ? { discoveredAt: new Date() } : {})
  };
  await prisma.jobPosting.upsert({
    where: { source_sourceJobId: { source: job.source, sourceJobId: job.sourceJobId } },
    create: { source: job.source, sourceJobId: job.sourceJobId, ...data },
    update: data
  });
  revalidateTag("public-global-jobs", "max");
  return { outcome: existing ? "updated" as const : "created" as const };
}