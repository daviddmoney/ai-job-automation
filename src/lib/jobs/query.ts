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
    if (filters.employmentTypes.length) {
      const employmentTerms = filters.employmentTypes.flatMap(type => {
        const terms: Prisma.JobPostingWhereInput[] = [
          { employmentType: { contains: type, mode: "insensitive" } }
        ];
        if (["graduate trainee", "internship", "apprenticeship", "entry-level"].includes(type.toLocaleLowerCase())) {
          terms.push({ title: { contains: type, mode: "insensitive" } });
        }
        return terms;
      });
      and.push({ OR: employmentTerms });
    }
    if (filters.jobCategories.length) {
      const familyTerms: Record<string, string[]> = {
        "accounting & finance": ["accountant", "accounting", "finance", "auditor", "audit", "tax", "payroll", "bookkeeper", "treasury", "banking", "investment", "risk"],
        "technology & software": ["software", "developer", "frontend", "backend", "full-stack", "mobile", "devops", "cloud", "data analyst", "data scientist", "machine learning", "artificial intelligence", "cybersecurity", "IT support", "database"],
        "administration & operations": ["administrative", "office manager", "operations", "executive assistant", "data entry", "records", "business support"],
        "human resources": ["human resources", "HR", "recruiter", "talent acquisition", "training", "compensation"],
        "sales & marketing": ["sales", "marketing", "business development", "SEO", "social media", "brand", "account manager", "market research"],
        "legal & compliance": ["lawyer", "legal", "paralegal", "compliance", "company secretary"],
        "engineering & manufacturing": ["engineer", "engineering", "manufacturing", "production", "quality", "process"],
        "healthcare & medical": ["doctor", "nurse", "pharmacist", "medical", "healthcare", "public health", "physiotherapist", "radiographer"],
        "education & research": ["teacher", "lecturer", "education", "researcher", "research assistant", "learning and development"],
        "customer service & support": ["customer service", "customer success", "call centre", "technical support", "client relations"],
        "logistics & supply chain": ["logistics", "supply chain", "procurement", "purchasing", "warehouse", "fleet", "inventory"],
        "project & business management": ["project", "programme", "program", "business analyst", "management consultant", "strategy"],
        "other professional fields": ["architect", "graphic design", "content writer", "journalist", "hospitality", "hotel", "agriculture", "environmental", "security", "government"]
      };
      const terms = [...new Set(filters.jobCategories.flatMap(category => familyTerms[category.toLocaleLowerCase()] ?? [category]))];
      and.push({
        OR: terms.flatMap(term => [
          { jobCategory: { contains: term, mode: "insensitive" } },
          { title: { contains: term, mode: "insensitive" } }
        ])
      });
    }

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
