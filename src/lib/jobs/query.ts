import { unstable_cache } from "next/cache";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export interface JobSearchFilters {
  preferredCountries: string[];
  preferredRegions: string[];
  preferredCities: string[];
  preferredWorkModes: Array<"ONSITE" | "HYBRID" | "REMOTE" | "FLEXIBLE">;
  employmentTypes: string[];
  jobCategories: string[];
  worldwideSearch: boolean;
}

const getCachedJobs = unstable_cache(
  async (filters: JobSearchFilters) => {
    const now = new Date();
    const since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const and: Prisma.JobPostingWhereInput[] = [
      { status: "ACTIVE" },
      { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
      { OR: [{ publishedAt: { gte: since } }, { discoveredAt: { gte: since } }] }
    ];
    if (filters.preferredWorkModes.length) and.push({ workMode: { in: filters.preferredWorkModes } });
    if (filters.employmentTypes.length) and.push({ employmentType: { in: filters.employmentTypes } });
    if (filters.jobCategories.length) and.push({ jobCategory: { in: filters.jobCategories } });

    const locations: Prisma.JobPostingWhereInput[] = [];
    for (const country of filters.preferredCountries) {
      locations.push(
        { country: { equals: country, mode: "insensitive" } },
        { eligibleLocations: { has: country } },
        { locationText: { contains: country, mode: "insensitive" } }
      );
    }
    for (const region of filters.preferredRegions) {
      locations.push({ state: { equals: region, mode: "insensitive" } }, { locationText: { contains: region, mode: "insensitive" } });
    }
    for (const city of filters.preferredCities) {
      locations.push({ city: { equals: city, mode: "insensitive" } }, { locationText: { contains: city, mode: "insensitive" } });
    }
    if (!filters.worldwideSearch && locations.length) and.push({ OR: locations });

    return prisma.jobPosting.findMany({
      where: { AND: and },
      select: {
        id: true, title: true, company: true, salaryText: true, employmentType: true, jobCategory: true,
        description: true, sourceLanguage: true, applicationUrl: true, locationText: true, workMode: true,
        source: true, publishedAt: true, discoveredAt: true
      },
      orderBy: [{ publishedAt: "desc" }, { discoveredAt: "desc" }],
      take: 100
    });
  },
  ["public-global-jobs-v1"],
  { revalidate: 60, tags: ["public-global-jobs"] }
);

/** Public vacancy data only. User-specific saved-job state is fetched separately. */
export function getRecentJobsForPreferences(filters: JobSearchFilters) {
  return getCachedJobs(filters);
}
