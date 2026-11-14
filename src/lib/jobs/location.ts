import type { JobWorkMode } from "@prisma/client";
const norm = (value: string | null | undefined) => (value ?? "").normalize("NFKC").trim().toLocaleLowerCase().replace(/\\s+/g, " ");
export interface JobLocationInput { workMode: JobWorkMode; locationText: string; city?: string | null; state?: string | null; country?: string | null; eligibleLocations?: string[]; }
export function normaliseJobLocation(input: JobLocationInput) {
 return { locationText: input.locationText.trim(), city: input.city?.trim() || null, state: input.state?.trim() || null, country: input.country?.trim() || null, eligibleLocations: (input.eligibleLocations ?? []).map(x => x.trim()).filter(Boolean) };
}
export function matchesJobLocationPreferences(input: JobLocationInput, pref: { preferredCountries?: string[]; preferredRegions?: string[]; preferredCities?: string[]; worldwideSearch?: boolean }) {
 if (pref.worldwideSearch || (!pref.preferredCountries?.length && !pref.preferredRegions?.length && !pref.preferredCities?.length)) return true;
 const matches = (value: string | null | undefined, list?: string[]) => Boolean(value && list?.some(x => norm(x) === norm(value)));
 if (matches(input.country, pref.preferredCountries) || matches(input.state, pref.preferredRegions) || matches(input.city, pref.preferredCities)) return true;
 return (input.workMode === "REMOTE" || input.workMode === "FLEXIBLE") && (input.eligibleLocations ?? []).some(place => [...(pref.preferredCountries ?? []), ...(pref.preferredRegions ?? []), ...(pref.preferredCities ?? [])].some(x => norm(x) === norm(place)));
}