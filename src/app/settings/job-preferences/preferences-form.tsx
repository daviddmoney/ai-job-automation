"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";

type Preferences = {
  preferredCountries: string[];
  preferredRegions: string[];
  preferredCities: string[];
  preferredWorkModes: string[];
  employmentTypes: string[];
  jobCategories: string[];
  interfaceLanguage: string;
  nativeLanguage: string | null;
  jobDescriptionLanguage: string;
  applicationLanguage: string;
  communicationLanguage: string;
  additionalLanguages: string[];
  worldwideSearch: boolean;
};

type Option = { value: string; label: string; group?: string };

const empty: Preferences = {
  preferredCountries: [], preferredRegions: [], preferredCities: [], preferredWorkModes: [],
  employmentTypes: [], jobCategories: [], interfaceLanguage: "en", nativeLanguage: "",
  jobDescriptionLanguage: "en", applicationLanguage: "en", communicationLanguage: "en",
  additionalLanguages: [], worldwideSearch: true,
};

const COUNTRY_CODES = `XK AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW`.split(" ");

const LANGUAGE_CODES = `aa ab ae af ak am an ar as av ay az ba be bg bh bi bm bn bo br bs ca ce ch co cr cs cu cv cy da de dv dz ee el en eo es et eu fa ff fi fj fo fr fy ga gd gl gn gu gv ha he hi ho hr ht hu hy hz ia id ie ig ii ik io is it iu ja jv ka kg ki kj kk kl km kn ko kr ks ku kv kw ky la lb lg li ln lo lt lu lv mg mh mi mk ml mn mr ms mt my na nb nd ne ng nl nn no nr nv ny oc oj om or os pa pi pl ps pt qu rm rn ro ru rw sa sc sd se sg si sk sl sm sn so sq sr ss st su sv sw ta te tg th ti tk tl tn to tr ts tt tw ty ug uk ur uz ve vi vo wa wo xh yi yo za zh zu`.split(" ");

const EMPLOYMENT_TYPES = [
  "Full-time", "Part-time", "Permanent", "Fixed-term", "Contract", "Temporary",
  "Internship", "Graduate Trainee", "Apprenticeship", "Freelance", "Self-employed",
  "Casual", "Seasonal", "Volunteer", "Commission-based", "Entry-level", "Consultancy", "On-call", "Zero-hours", "Shift-based", "Project-based", "Gig / Platform work", "Commission-only", "Returnship", "Co-operative placement", "Work-study", "Probationary",
];

const WORK_MODES = [
  { value: "ONSITE", label: "On-site" }, { value: "HYBRID", label: "Hybrid" },
  { value: "REMOTE", label: "Remote" }, { value: "FLEXIBLE", label: "Flexible" },
];

const CATEGORY_GROUPS: Record<string, string[]> = {
  "Accounting & Finance": ["Accountant", "Junior Accountant", "Financial Accountant", "Management Accountant", "Cost Accountant", "Tax Accountant", "Auditor", "Internal Auditor", "External Auditor", "Finance Officer", "Finance Manager", "Financial Analyst", "Accounts Payable Officer", "Accounts Receivable Officer", "Payroll Officer", "Treasury Analyst", "Bookkeeper", "Investment Analyst", "Risk Analyst", "Banking Officer"],
  "Technology & Software": ["Software Engineer", "Frontend Engineer", "Backend Engineer", "Full-stack Engineer", "Mobile Developer", "DevOps Engineer", "Cloud Engineer", "Data Analyst", "Data Scientist", "Machine Learning Engineer", "AI Engineer", "Cybersecurity Analyst", "QA Engineer", "Product Manager", "UX Designer", "UI Designer", "IT Support Specialist", "Systems Administrator", "Database Administrator"],
  "Administration & Operations": ["Administrative Assistant", "Office Manager", "Operations Officer", "Operations Manager", "Executive Assistant", "Data Entry Clerk", "Records Officer", "Business Support Officer"],
  "Human Resources": ["HR Assistant", "HR Officer", "HR Business Partner", "Recruiter", "Talent Acquisition Specialist", "Training Officer", "Compensation & Benefits Analyst"],
  "Sales & Marketing": ["Sales Representative", "Account Manager", "Business Development Officer", "Marketing Officer", "Digital Marketing Specialist", "SEO Specialist", "Social Media Manager", "Brand Manager", "Market Research Analyst"],
  "Legal & Compliance": ["Lawyer", "Legal Officer", "Legal Assistant", "Paralegal", "Compliance Officer", "Compliance Analyst", "Company Secretary"],
  "Engineering & Manufacturing": ["Civil Engineer", "Mechanical Engineer", "Electrical Engineer", "Chemical Engineer", "Structural Engineer", "Production Engineer", "Quality Engineer", "Process Engineer"],
  "Healthcare & Medical": ["Doctor", "Nurse", "Pharmacist", "Medical Laboratory Scientist", "Healthcare Assistant", "Public Health Officer", "Physiotherapist", "Radiographer"],
  "Education & Research": ["Teacher", "Lecturer", "Academic Researcher", "Research Assistant", "Education Officer", "Learning & Development Specialist"],
  "Customer Service & Support": ["Customer Service Representative", "Customer Success Manager", "Call Centre Agent", "Technical Support Specialist", "Client Relations Officer"],
  "Logistics & Supply Chain": ["Logistics Officer", "Supply Chain Analyst", "Procurement Officer", "Purchasing Manager", "Warehouse Supervisor", "Fleet Manager", "Inventory Controller"],
  "Project & Business Management": ["Project Coordinator", "Project Manager", "Programme Manager", "Business Analyst", "Management Consultant", "Strategy Analyst"],
  "Other Professional Fields": ["Architect", "Graphic Designer", "Content Writer", "Journalist", "Hospitality Officer", "Hotel Manager", "Agricultural Officer", "Environmental Specialist", "Security Officer", "Government Officer"],
  "Construction & Property": ["Construction Manager", "Quantity Surveyor", "Site Engineer", "Building Surveyor", "Land Surveyor", "Estate Surveyor", "Property Manager", "Real Estate Agent", "Town Planner", "Facilities Manager", "Carpenter", "Mason", "Plumber", "Electrician", "Painter"],
  "Transport & Aviation": ["Pilot", "Cabin Crew", "Air Traffic Controller", "Flight Operations Officer", "Truck Driver", "Bus Driver", "Delivery Driver", "Train Driver", "Transport Planner", "Dispatch Officer", "Marine Engineer", "Ship Captain", "Port Operations Officer"],
  "Science & Environment": ["Biologist", "Chemist", "Physicist", "Laboratory Technician", "Geologist", "Environmental Scientist", "Environmental Officer", "Climate Analyst", "Conservation Officer", "Food Scientist", "Statistician", "Research Scientist"],
  "Media & Creative": ["Graphic Artist", "Animator", "Photographer", "Video Editor", "Film Producer", "Broadcast Journalist", "Editor", "Copywriter", "Translator", "Interpreter", "Musician", "Sound Engineer", "Public Relations Officer"],
  "Hospitality & Tourism": ["Hotel Receptionist", "Hotel Manager", "Chef", "Cook", "Restaurant Manager", "Waiter", "Barista", "Travel Consultant", "Tour Guide", "Event Planner", "Housekeeping Supervisor"],
  "Agriculture & Food": ["Agronomist", "Agricultural Engineer", "Farm Manager", "Agricultural Extension Officer", "Veterinarian", "Veterinary Nurse", "Fisheries Officer", "Forestry Officer", "Food Technologist", "Food Safety Officer", "Butcher", "Horticulturist"],
  "Public Service & Development": ["Public Administrator", "Policy Analyst", "Diplomat", "Development Officer", "Monitoring and Evaluation Officer", "Humanitarian Officer", "Social Worker", "Community Development Officer", "Programme Officer", "Public Health Researcher"],
  "Security & Emergency Services": ["Police Officer", "Firefighter", "Security Analyst", "Security Guard", "Emergency Medical Technician", "Paramedic", "Disaster Risk Officer", "Occupational Safety Officer", "Health and Safety Manager"],
  "Skilled Trades & Maintenance": ["Automotive Mechanic", "Diesel Mechanic", "Welding Technician", "HVAC Technician", "Maintenance Technician", "Machine Operator", "CNC Operator", "Electronics Technician", "Telecommunications Technician", "Appliance Repair Technician"],
  "Insurance & Actuarial": ["Actuary", "Insurance Underwriter", "Claims Adjuster", "Insurance Broker", "Insurance Officer", "Pension Administrator", "Actuarial Analyst"],
  "Retail & E-commerce": ["Retail Sales Assistant", "Store Manager", "Merchandiser", "E-commerce Manager", "E-commerce Specialist", "Category Manager", "Buyer", "Visual Merchandiser"],
  "Energy & Utilities": ["Petroleum Engineer", "Mining Engineer", "Renewable Energy Engineer", "Power Systems Engineer", "Energy Analyst", "Utilities Technician", "Oil and Gas Operator", "Electrical Power Technician"],
  "Sports & Recreation": ["Sports Coach", "Athlete", "Fitness Instructor", "Personal Trainer", "Sports Administrator", "Sports Therapist", "Recreation Officer"],
  "Telecommunications": ["Telecommunications Engineer", "Network Engineer", "Radio Frequency Engineer", "Telecoms Technician", "Network Operations Analyst"],
  "ISCO-08 Major Occupational Groups": ["Managers", "Professionals", "Technicians and Associate Professionals", "Clerical Support Workers", "Service and Sales Workers", "Skilled Agricultural, Forestry and Fishery Workers", "Craft and Related Trades Workers", "Plant and Machine Operators and Assemblers", "Elementary Occupations", "Armed Forces Occupations"],
};

const countryNames = new Intl.DisplayNames(["en"], { type: "region" });
const languageNames = new Intl.DisplayNames(["en"], { type: "language" });
const COUNTRIES: Option[] = COUNTRY_CODES.map(code => ({
  value: countryNames.of(code) || code,
  label: `${String.fromCodePoint(0x1F1E6 + code.charCodeAt(0) - 65, 0x1F1E6 + code.charCodeAt(1) - 65)} ${countryNames.of(code) || code}`,
})).sort((a, b) => a.value.localeCompare(b.value));
const LANGUAGES: Option[] = LANGUAGE_CODES.map(code => ({
  value: code,
  label: `${languageNames.of(code) || code} (${code})`,
})).sort((a, b) => a.label.localeCompare(b.label));
const EMPLOYMENT_OPTIONS = EMPLOYMENT_TYPES.map(value => ({ value, label: value }));
const CATEGORY_OPTIONS: Option[] = Object.entries(CATEGORY_GROUPS).flatMap(([group, titles]) => [
  { value: group, label: group, group: "Job families" },
  ...titles.map(title => ({ value: title, label: title, group })),
]);

function LanguageSingleSelect({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<Option[]>(LANGUAGES);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const current = value.trim();
    if (!current || LANGUAGES.some(option => option.value === current)) return;
    const controller = new AbortController();
    fetch(`/api/languages?code=${encodeURIComponent(current)}`, { signal: controller.signal })
      .then(response => response.ok ? response.json() : Promise.reject(new Error("Language lookup unavailable")))
      .then(result => { if (Array.isArray(result?.items)) setOptions(old => [...new Map<string, Option>([...old, ...result.items].map((option: Option) => [option.value, option] as [string, Option])).values()]); })
      .catch(() => undefined);
    return () => controller.abort();
  }, [value]);
  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) { setOptions(LANGUAGES); return; }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/languages?q=${encodeURIComponent(term)}`, { signal: controller.signal });
        if (!response.ok) throw new Error("Language lookup unavailable");
        const result = await response.json();
        if (Array.isArray(result?.items)) setOptions([...new Map<string, Option>([...LANGUAGES, ...result.items].map((option: Option) => [option.value, option] as [string, Option])).values()]);
      } catch { if (!controller.signal.aborted) setOptions(LANGUAGES); }
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query]);
  const selected = options.find(option => option.value === value);
  const visible = options.filter(option => !query.trim() || option.label.toLocaleLowerCase().includes(query.toLocaleLowerCase()) || option.value.toLocaleLowerCase().includes(query.toLocaleLowerCase())).slice(0, 100);
  return <div style={fieldStyle}>
    <strong>{label}</strong>
    <div style={{ border: "1px solid var(--border, #ccd3df)", borderRadius: 9, padding: 8, background: "var(--panel, white)", position: "relative" }}>
      <div style={{ fontSize: 13, color: "var(--muted, #667085)", padding: "2px 5px 5px" }}>{selected?.label || (value ? `Saved language: ${value}` : "No language selected")}</div>
      <input value={query} onFocus={() => setOpen(true)} onChange={event => { setQuery(event.target.value); setOpen(true); }} onKeyDown={event => { if (event.key === "Enter") event.preventDefault(); }} placeholder={`Search ${label.toLocaleLowerCase()}…`} aria-label={`Search ${label}`} style={{ ...textInput, border: 0, padding: 7 }} />
      {open && <div style={{ maxHeight: 210, overflowY: "auto", borderTop: "1px solid var(--border, #e5e9f0)", marginTop: 5, paddingTop: 5 }}>
        <button type="button" onClick={() => { onChange(""); setQuery(""); setOpen(false); }} style={smallAction}>Clear selection</button>
        {visible.map(option => <button type="button" key={option.value} onClick={() => { onChange(option.value); setQuery(""); setOpen(false); }} style={{ display: "block", width: "100%", textAlign: "left", padding: 8, border: 0, background: option.value === value ? "var(--surface, #eef2f7)" : "transparent", color: "inherit", cursor: "pointer" }}>{option.label}</button>)}
        {query.trim().length >= 2 && !visible.length && <button type="button" onClick={() => { onChange(query.trim()); setQuery(""); setOpen(false); }} style={smallAction}>Use custom language: {query.trim()}</button>}
        {!visible.length && <p style={{ padding: 8, fontSize: 13, color: "var(--muted, #667085)" }}>No matching language found.</p>}
        <button type="button" onClick={() => setOpen(false)} style={smallAction}>Close</button>
      </div>}
    </div>
  </div>;
}
function MultiSelect({
  label, hint, options, value, onChange, disabled = false, placeholder = "Search and select…", allowCustom = false, allowSelectAll = true, onQueryChange,
}: {
  label: string; hint?: string; options: Option[]; value: string[];
  onChange: (value: string[]) => void; disabled?: boolean; placeholder?: string; allowCustom?: boolean; allowSelectAll?: boolean; onQueryChange?: (query: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase();
    return (q ? options.filter(option => option.label.toLocaleLowerCase().includes(q) || option.value.toLocaleLowerCase().includes(q)) : options).slice(0, 300);
  }, [options, query]);
  const selectedLabels = value.map(item => options.find(option => option.value === item)?.label || item);
  function toggle(item: string) {
    onChange(value.includes(item) ? value.filter(x => x !== item) : [...value, item]);
  }
  function addCustom() {
    const item = query.trim();
    if (!allowCustom || !item) return;
    const existing = options.find(option => option.value.toLocaleLowerCase() === item.toLocaleLowerCase());
    const normalized = existing?.value || item;
    if (!value.includes(normalized)) onChange([...value, normalized]);
    setQuery("");
  }
  return <div style={{ display: "grid", gap: 7, marginBottom: 18, opacity: disabled ? 0.58 : 1 }}>
    <strong>{label}</strong>
    {hint && <span style={{ color: "var(--muted, #667085)", fontSize: 13 }}>{hint}</span>}
    <div style={{ border: "1px solid var(--border, #ccd3df)", borderRadius: 10, padding: 9, background: "var(--panel, white)" }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: selectedLabels.length ? 8 : 0 }}>
        {selectedLabels.map((item, index) => <span key={value[index]} style={{ display: "inline-flex", alignItems: "center", gap: 6, borderRadius: 20, padding: "4px 8px", background: "var(--surface, #eef2f7)", fontSize: 12 }}>
          {item}<button type="button" aria-label={`Remove ${item}`} onClick={() => toggle(value[index])} style={{ border: 0, background: "transparent", cursor: "pointer", fontWeight: 700 }}>×</button>
        </span>)}
      </div>
      <input disabled={disabled} value={query} onFocus={() => setOpen(true)} onChange={event => { setQuery(event.target.value); onQueryChange?.(event.target.value); setOpen(true); }} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); if (allowCustom) addCustom(); } }} placeholder={placeholder} aria-label={`Search ${label}`} style={{ width: "100%", border: 0, outline: "none", padding: 7, background: "transparent", color: "inherit" }} />
      {open && !disabled && <div style={{ maxHeight: 230, overflowY: "auto", borderTop: "1px solid var(--border, #e5e9f0)", marginTop: 5, paddingTop: 5 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "4px 5px 8px" }}>
          {allowSelectAll && <button type="button" onClick={() => onChange([...new Set([...value, ...filtered.map(option => option.value)])])} style={smallAction}>Select all shown</button>}
          {allowCustom && <button type="button" onClick={addCustom} style={smallAction} disabled={!query.trim()}>Add “{query.trim() || "custom"}”</button>}
          <button type="button" onClick={() => setOpen(false)} style={smallAction}>Close</button>
        </div>
        {filtered.map(option => <label key={option.value} style={{ display: "flex", alignItems: "center", gap: 9, padding: "6px 5px", cursor: "pointer", fontSize: 14 }}>
          <input type="checkbox" checked={value.includes(option.value)} onChange={() => toggle(option.value)} />
          <span>{option.label}</span>
        </label>)}
        {!filtered.length && <p style={{ padding: 8, color: "#667085", fontSize: 13 }}>No matches. Try another search.</p>}
        {filtered.length === 300 && <p style={{ padding: 6, color: "#667085", fontSize: 12 }}>Showing the first 300 matches. Refine your search.</p>}
      </div>}
    </div>
    <span style={{ color: "var(--muted, #667085)", fontSize: 12 }}>{value.length} selected</span>
  </div>;
}

const smallAction = { border: 0, background: "transparent", color: "#3157a4", cursor: "pointer", fontSize: 12, fontWeight: 600 } as const;
const fieldStyle = { display: "grid", gap: 7, marginBottom: 18 } as const;
const textInput = { width: "100%", padding: 11, border: "1px solid var(--border, #ccd3df)", borderRadius: 9, background: "var(--panel, white)", color: "inherit" } as const;

async function loadStates(country: string): Promise<string[]> {
  const response = await fetch(`/api/locations?type=states&country=${encodeURIComponent(country)}`);
  if (!response.ok) throw new Error("Could not load regions");
  const result = await response.json();
  return Array.isArray(result?.items) ? result.items.filter((item: unknown): item is string => typeof item === "string") : [];
}
async function loadCities(country: string, state: string): Promise<string[]> {
  const params = new URLSearchParams({ type: "cities", country, state });
  const response = await fetch(`/api/locations?${params.toString()}`);
  if (!response.ok) throw new Error("Could not load cities");
  const result = await response.json();
  return Array.isArray(result?.items) ? result.items.filter((item: unknown): item is string => typeof item === "string") : [];
}

export default function JobPreferencesForm() {
  const [data, setData] = useState<Preferences>(empty);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [regionOptions, setRegionOptions] = useState<Option[]>([]);
  const [cityOptions, setCityOptions] = useState<Option[]>([]);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState("");
  const [languageSearch, setLanguageSearch] = useState("");
  const [languageOptions, setLanguageOptions] = useState<Option[]>(LANGUAGES);
  const [occupationSearch, setOccupationSearch] = useState("");
  const [occupationOptions, setOccupationOptions] = useState<Option[]>(CATEGORY_OPTIONS);

  useEffect(() => {
    const missing = data.additionalLanguages.filter(code =>
      !LANGUAGES.some(option => option.value === code)
    );
    if (!missing.length) return;
    const controller = new AbortController();
    Promise.all(missing.map(async code => {
      try {
        const response = await fetch(`/api/languages?code=${encodeURIComponent(code)}`, { signal: controller.signal });
        if (!response.ok) return [];
        const result = await response.json();
        return Array.isArray(result?.items) ? result.items as Option[] : [];
      } catch { return []; }
    })).then(results => {
      if (controller.signal.aborted) return;
      const remote = results.flat();
      setLanguageOptions(old => [...new Map<string, Option>([...old, ...remote].map(option => [option.value, option] as [string, Option])).values()]);
    });
    return () => controller.abort();
  }, [data.additionalLanguages]);

  useEffect(() => {
    const selected = data.jobCategories.filter(value => value.startsWith("ISCO08:"));
    if (!selected.length) return;
    const controller = new AbortController();
    Promise.all(selected.map(async code => {
      try {
        const response = await fetch(`/api/occupations?code=${encodeURIComponent(code)}`, { signal: controller.signal });
        if (!response.ok) return [];
        const result = await response.json();
        return Array.isArray(result?.items) ? result.items as Option[] : [];
      } catch { return []; }
    })).then(results => {
      if (controller.signal.aborted) return;
      const remote = results.flat();
      setOccupationOptions(old => [...new Map<string, Option>([...old, ...remote].map(option => [option.value, option] as [string, Option])).values()]);
    });
    return () => controller.abort();
  }, [data.jobCategories]);

  useEffect(() => {
    let active = true;
    fetch("/api/preferences/jobs").then(response => response.json()).then(result => {
      if (active && result.preferences) setData({ ...empty, ...result.preferences });
    }).catch(() => { if (active) setMessage("Unable to load saved preferences."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    if (!data.preferredCountries.length) {
      setRegionOptions([]); setCityOptions([]);
      return () => { active = false; };
    }
    setLocationLoading(true); setLocationError("");
    Promise.all(data.preferredCountries.map(async country => {
      try { return { country, states: await loadStates(country) }; }
      catch { return { country, states: [] as string[] }; }
    })).then(results => {
      if (!active) return;
      const options = results.flatMap(({ country, states }) => states.map(state => ({ value: `${state}::${country}`, label: `${state}, ${country}`, group: country })));
      setRegionOptions(options);
      if (results.every(result => !result.states.length)) setLocationError("Regional data is temporarily unavailable. You can still use worldwide search and your saved locations.");
    }).finally(() => { if (active) setLocationLoading(false); });
    return () => { active = false; };
  }, [data.preferredCountries]);

  useEffect(() => {
    const query = languageSearch.trim();
    if (query.length < 2) { setLanguageOptions(LANGUAGES); return; }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/languages?q=${encodeURIComponent(query)}`, { signal: controller.signal });
        if (!response.ok) throw new Error("Language lookup unavailable");
        const result = await response.json();
        const remote = Array.isArray(result?.items) ? result.items as Option[] : [];
        setLanguageOptions([...new Map<string, Option>([...LANGUAGES, ...remote].map(option => [option.value, option] as [string, Option])).values()]);
      } catch { if (!controller.signal.aborted) setLanguageOptions(LANGUAGES); }
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [languageSearch]);

  useEffect(() => {
    const query = occupationSearch.trim();
    if (query.length < 2) { setOccupationOptions(CATEGORY_OPTIONS); return; }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/occupations?q=${encodeURIComponent(query)}`, { signal: controller.signal });
        if (!response.ok) throw new Error("Occupation lookup unavailable");
        const result = await response.json();
        const remote = Array.isArray(result?.items) ? result.items as Option[] : [];
        setOccupationOptions([...new Map<string, Option>([...CATEGORY_OPTIONS, ...remote].map(option => [option.value, option] as [string, Option])).values()]);
      } catch { if (!controller.signal.aborted) setOccupationOptions(CATEGORY_OPTIONS); }
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [occupationSearch]);

  useEffect(() => {
    let active = true;
    if (!data.preferredRegions.length) { setCityOptions([]); return () => { active = false; }; }
    const selectedRegions = data.preferredRegions.map(region => {
      if (region.includes("::")) {
        const [state, country] = region.split("::");
        return state && country ? { state, country } : null;
      }
      const matches = regionOptions.filter(item => item.label.split(", ")[0] === region);
      return matches.length === 1 ? { state: region, country: matches[0].group || "" } : null;
    }).filter((item): item is { state: string; country: string } => Boolean(item?.country));
    Promise.all(selectedRegions.map(async item => {
      try { return { ...item, cities: await loadCities(item.country, item.state) }; }
      catch { return { ...item, cities: [] as string[] }; }
    })).then(results => {
      if (!active) return;
      setCityOptions(results.flatMap(({ country, state, cities }) => cities.map(city => ({ value: `${city}::${state}::${country}`, label: `${city}, ${state}, ${country}`, group: state }))));
    });
    return () => { active = false; };
  }, [data.preferredRegions, regionOptions]);

  function update<K extends keyof Preferences>(key: K, value: Preferences[K]) {
    setData(old => ({ ...old, [key]: value }));
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setMessage("");
    try {
      const payload = { ...data, nativeLanguage: data.nativeLanguage?.trim() || null };
      const response = await fetch("/api/preferences/jobs", {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      const result = await response.json();
      setMessage(response.ok ? "Preferences saved successfully." : result.message || "Unable to save preferences.");
    } catch { setMessage("Unable to reach the server."); }
    finally { setSaving(false); }
  }

  if (loading) return <p>Loading your preferences…</p>;

  return <form onSubmit={save} style={{ background: "var(--panel)", border: "1px solid var(--border, #e5e9f0)", borderRadius: 14, padding: 22 }}>
    <h2 style={{ fontSize: 21, marginTop: 0 }}>Location preferences</h2>
    <p style={{ color: "var(--muted, #667085)", lineHeight: 1.6, fontSize: 14 }}>Choose multiple countries, then narrow your search to their states, regions and cities. Location lists are loaded on demand.</p>
    <MultiSelect label="Preferred countries" hint="Search the international country list. Select as many as you like." options={COUNTRIES} value={data.preferredCountries} onChange={countries => setData(old => ({ ...old, preferredCountries: countries, preferredRegions: [], preferredCities: [] }))} placeholder="Search countries…" allowSelectAll={false} />
    <MultiSelect label="Preferred states / regions" hint="Options are filtered by your selected countries." options={regionOptions} value={data.preferredRegions} onChange={regions => setData(old => ({ ...old, preferredRegions: regions, preferredCities: [] }))} disabled={!data.preferredCountries.length || locationLoading} placeholder={locationLoading ? "Loading regions…" : "Search states and regions…"} allowCustom />
    <MultiSelect label="Preferred cities" hint="Options are filtered by your selected states and regions." options={cityOptions} value={data.preferredCities} onChange={cities => update("preferredCities", cities)} disabled={!data.preferredRegions.length} placeholder="Search cities…" allowCustom />
    {locationError && <p role="status" style={{ color: "#9a6700", fontSize: 13 }}>{locationError}</p>}
    <label style={{ display: "flex", alignItems: "center", gap: 10, margin: "4px 0 22px" }}>
      <input type="checkbox" checked={data.worldwideSearch} onChange={event => update("worldwideSearch", event.target.checked)} />
      <span><strong>Search worldwide</strong><br /><small style={{ color: "var(--muted, #667085)" }}>Include suitable opportunities outside my selected locations.</small></span>
    </label>

    <hr style={{ border: 0, borderTop: "1px solid var(--border, #e5e9f0)", margin: "22px 0" }} />
    <h2 style={{ fontSize: 21 }}>Employment preferences</h2>
    <MultiSelect label="Employment types" hint="Select one or more contract and employment arrangements." options={EMPLOYMENT_OPTIONS} value={data.employmentTypes} onChange={value => update("employmentTypes", value)} allowCustom />
    <div style={{ display: "grid", gap: 8, marginBottom: 18 }}>
      <strong>Work arrangements</strong>
      <span style={{ color: "var(--muted, #667085)", fontSize: 13 }}>These describe where work is performed, not the employment contract type.</span>
      {WORK_MODES.map(mode => <label key={mode.value} style={{ display: "flex", alignItems: "center", gap: 9 }}>
        <input type="checkbox" checked={data.preferredWorkModes.includes(mode.value)} onChange={event => update("preferredWorkModes", event.target.checked ? [...data.preferredWorkModes, mode.value] : data.preferredWorkModes.filter(item => item !== mode.value))} />
        {mode.label}
      </label>)}
    </div>
    <MultiSelect label="Job categories and job titles" hint="Select a broad job family or specific roles. You can select several. Standard occupation groups: ILO ISCO-08." options={occupationOptions} value={data.jobCategories} onChange={value => update("jobCategories", value)} placeholder="Search job families, job titles and ISCO-08 occupations…" allowCustom onQueryChange={setOccupationSearch} />

    <hr style={{ border: 0, borderTop: "1px solid var(--border, #e5e9f0)", margin: "22px 0" }} />
    <h2 style={{ fontSize: 21 }}>Language preferences</h2>
    <p style={{ color: "var(--muted, #667085)", fontSize: 14, lineHeight: 1.6 }}>Search across ISO 639-1 and ISO 639-3 language identifiers, including thousands of individual living, historical, ancient and constructed languages. Common languages retain their two-letter ISO 639-1 codes; languages without one use their three-letter ISO 639-3 code.</p><br /><small>Language-code source: SIL International, ISO 639-3 (iso639-3.sil.org).</small>
    {([
      ["interfaceLanguage", "Website interface language"],
      ["nativeLanguage", "Native language"],
      ["jobDescriptionLanguage", "Preferred job-description language"],
      ["applicationLanguage", "Application language"],
      ["communicationLanguage", "Employer communication language"],
    ] as const).map(([key, label]) => <LanguageSingleSelect key={key} label={label} value={data[key] ?? ""} onChange={value => update(key, value as never)} />)}
    <MultiSelect label="Additional languages" hint="Languages you can use or understand. Select multiple." options={languageOptions} value={data.additionalLanguages} onChange={value => update("additionalLanguages", value)} placeholder="Search all ISO language codes and names…" allowCustom onQueryChange={setLanguageSearch} />

    <button disabled={saving} type="submit" style={{ border: 0, borderRadius: 9, padding: "12px 19px", background: "#24458b", color: "white", fontWeight: 700, cursor: saving ? "wait" : "pointer" }}>
      {saving ? "Saving…" : "Save preferences"}
    </button>
    {message && <p role="status" aria-live="polite" style={{ color: message.includes("successfully") ? "#16794b" : "#3657a7", marginBottom: 0 }}>{message}</p>}
    <p style={{ color: "var(--muted, #667085)", fontSize: 12, marginBottom: 0, marginTop: 12 }}>Your preferences are private to your account and can be changed at any time.</p>
  </form>;
}
