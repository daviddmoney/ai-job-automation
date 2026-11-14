import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";

const getCachedLagosJobs = unstable_cache(
  async () => {
    const now = new Date();
    const since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    return prisma.jobPosting.findMany({
      where: {
        status: "ACTIVE",
        country: "Nigeria",
        AND: [
          { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
          { OR: [{ publishedAt: { gte: since } }, { discoveredAt: { gte: since } }] },
          { OR: [
            { workMode: { in: ["ONSITE", "HYBRID"] }, city: "Lagos" },
            { workMode: "REMOTE", eligibleLocations: { hasSome: ["Lagos", "Lagos, Nigeria"] } }
          ] }
        ]
      },
      select: {
        id: true,
        title: true,
        company: true,
        salaryText: true,
        employmentType: true,
        description: true,
        applicationUrl: true,
        locationText: true,
        workMode: true,
        source: true,
        publishedAt: true,
        discoveredAt: true
      },
      orderBy: [{ publishedAt: "desc" }, { discoveredAt: "desc" }],
      take: 50
    });
  },
  ["public-lagos-jobs-v1"],
  { revalidate: 60, tags: ["public-lagos-jobs"] }
);

/** Public vacancy data only: never include a user's saved jobs or profile in this shared cache. */
export function getRecentLagosJobs() {
  return getCachedLagosJobs();
}
