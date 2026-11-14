import type { JobWorkMode } from "@prisma/client";

const normalise = (value: string | null | undefined) => (value ?? "").trim().toLowerCase().replace(/\\s+/g, " ");

export interface LagosLocationInput {
  workMode: JobWorkMode;
  locationText: string;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  eligibleLocations?: string[];
}

/** Strict allow-list: a generic Nigeria-wide remote role is not automatically a Lagos role. */
export function isLagosOpportunity(input: LagosLocationInput) {
  const country = normalise(input.country) || (normalise(input.locationText).includes("nigeria") ? "nigeria" : "");
  if (country !== "nigeria" && country !== "ng") return false;

  if (input.workMode === "REMOTE") {
    return (input.eligibleLocations ?? []).some((place) => {
      const value = normalise(place);
      return value === "lagos" || value === "lagos, nigeria" || value === "lagos nigeria";
    });
  }

  const city = normalise(input.city) || normalise(input.locationText.split(",")[0]);
  const state = normalise(input.state);
  return city === "lagos" || state === "lagos";
}

export function canonicalLagosLocation(input: LagosLocationInput) {
  if (!isLagosOpportunity(input)) return null;
  return {
    city: "Lagos",
    state: "Lagos",
    country: "Nigeria",
    locationText: input.locationText.trim() || "Lagos, Nigeria",
    eligibleLocations: input.workMode === "REMOTE" ? ["Lagos, Nigeria"] : input.eligibleLocations ?? []
  };
}
