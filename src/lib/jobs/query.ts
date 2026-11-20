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
        "other professional fields": ["architect", "graphic design", "content writer", "journalist", "hospitality", "hotel", "agriculture", "environmental", "security", "government"],
        "construction & property": ["construction", "quantity surveyor", "site engineer", "building surveyor", "land surveyor", "estate surveyor", "property manager", "real estate", "town planner", "facilities manager", "carpenter", "mason", "plumber", "electrician"],
        "transport & aviation": ["pilot", "cabin crew", "air traffic", "flight operations", "truck driver", "bus driver", "delivery driver", "train driver", "transport planner", "dispatch", "marine engineer", "ship captain", "port operations"],
        "science & environment": ["biologist", "chemist", "physicist", "laboratory", "geologist", "environmental", "climate", "conservation", "food scientist", "statistician", "research scientist"],
        "media & creative": ["graphic artist", "animator", "photographer", "video editor", "film producer", "journalist", "editor", "copywriter", "translator", "interpreter", "musician", "sound engineer", "public relations"],
        "hospitality & tourism": ["hotel", "chef", "cook", "restaurant", "waiter", "barista", "travel consultant", "tour guide", "event planner", "housekeeping"],
        "agriculture & food": ["agronomist", "agricultural", "farm manager", "veterinarian", "veterinary", "fisheries", "forestry", "food technologist", "food safety", "butcher", "horticulturist"],
        "public service & development": ["public administrator", "policy analyst", "diplomat", "development officer", "monitoring and evaluation", "humanitarian", "social worker", "community development", "programme officer", "public health"],
        "security & emergency services": ["police", "firefighter", "security", "emergency medical", "paramedic", "disaster risk", "occupational safety", "health and safety"],
        "skilled trades & maintenance": ["automotive mechanic", "diesel mechanic", "welding", "HVAC", "maintenance technician", "machine operator", "CNC", "electronics technician", "telecommunications technician", "appliance repair"],
        "insurance & actuarial": ["actuary", "insurance", "underwriter", "claims adjuster", "pension administrator"],
        "retail & e-commerce": ["retail", "store manager", "merchandiser", "e-commerce", "category manager", "buyer"],
        "energy & utilities": ["petroleum", "mining engineer", "renewable energy", "power systems", "energy analyst", "utilities", "oil and gas"],
        "sports & recreation": ["sports coach", "athlete", "fitness instructor", "personal trainer", "sports administrator", "sports therapist", "recreation"],
        "telecommunications": ["telecommunications", "network engineer", "radio frequency", "telecoms", "network operations"],
        "isco-08 major occupational groups": ["manager", "professional", "technician", "associate professional", "clerical", "service", "sales", "agricultural", "forestry", "fishery", "craft", "trades", "plant operator", "machine operator", "elementary occupation", "armed forces"]
      };
      const terms = [...new Set(filters.jobCategories.flatMap(category => familyTerms[category.toLocaleLowerCase()] ?? [category]))];
      const categoryFilters: Prisma.JobPostingWhereInput[] = terms.flatMap((term): Prisma.JobPostingWhereInput[] => [
        { jobCategory: { contains: term, mode: "insensitive" } },
        { title: { contains: term, mode: "insensitive" } }
      ]);
      and.push({ OR: categoryFilters });
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
      const [regionName, regionCountry] = region.split("::");
      const regionMatch: Prisma.JobPostingWhereInput = regionCountry
        ? { AND: [
            { OR: [{ state: { equals: regionName, mode: "insensitive" } }, { locationText: { contains: regionName, mode: "insensitive" } }] },
            { OR: [{ country: { equals: regionCountry, mode: "insensitive" } }, { locationText: { contains: regionCountry, mode: "insensitive" } }] }
          ] }
        : { OR: [{ state: { equals: regionName, mode: "insensitive" } }, { locationText: { contains: regionName, mode: "insensitive" } }] };
      locations.push(regionMatch);
    }
    for (const city of filters.preferredCities) {
      const [cityName, cityRegion, cityCountry] = city.split("::");
      const cityMatch: Prisma.JobPostingWhereInput = cityRegion && cityCountry
        ? { AND: [
            { OR: [{ city: { equals: cityName, mode: "insensitive" } }, { locationText: { contains: cityName, mode: "insensitive" } }] },
            { OR: [{ state: { equals: cityRegion, mode: "insensitive" } }, { locationText: { contains: cityRegion, mode: "insensitive" } }] },
            { OR: [{ country: { equals: cityCountry, mode: "insensitive" } }, { locationText: { contains: cityCountry, mode: "insensitive" } }] }
          ] }
        : { OR: [{ city: { equals: cityName, mode: "insensitive" } }, { locationText: { contains: cityName, mode: "insensitive" } }] };
      locations.push(cityMatch);
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
