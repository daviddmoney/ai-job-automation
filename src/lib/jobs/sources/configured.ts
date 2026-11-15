import type { JobSourceAdapter } from "@/lib/jobs/sources/adapter";
import { AshbyAdapter } from "@/lib/jobs/sources/ashby";
import { GreenhouseAdapter } from "@/lib/jobs/sources/greenhouse";
import { LeverAdapter } from "@/lib/jobs/sources/lever";
import { JoobleNigeriaAdapter } from "@/lib/jobs/sources/jooble-ng";
const list = (value?: string) => (value ?? "").split(",").map(x => x.trim()).filter(Boolean);
export function configuredJobAdapters(): JobSourceAdapter[] {
 const adapters: JobSourceAdapter[] = [];
 const greenhouse = list(process.env.GREENHOUSE_BOARD_TOKENS);
 const lever = list(process.env.LEVER_SITE_NAMES);
 const ashby = list(process.env.ASHBY_BOARD_NAMES);
 if (greenhouse.length) adapters.push(new GreenhouseAdapter(greenhouse));
 if (lever.length) adapters.push(new LeverAdapter(lever));
 if (ashby.length) adapters.push(new AshbyAdapter(ashby));
 if (process.env.JOOBLE_NG_API_KEY) adapters.push(new JoobleNigeriaAdapter());
 return adapters;
}