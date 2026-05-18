import { RawJob } from "../types/job";

export type NormalizedRaw = {
  title: string;
  company_name: string;
  location_name: string;
  salary_min?: number;
  salary_max?: number;
  salary_currency: string;
  is_remote: boolean;
};

const LOCATION_MAP: Record<string, string> = {
  "NYC": "New York, NY",
  "NEW YORK CITY": "New York, NY",
  "SF": "San Francisco, CA",
  "SAN FRAN": "San Francisco, CA",
  "SAN FRANCISCO": "San Francisco, CA",
  "LA": "Los Angeles, CA",
  "LOS ANGELES": "Los Angeles, CA",
  "DC": "Washington, DC",
  "WASHINGTON DC": "Washington, DC",
  "WASHINGTON, D.C.": "Washington, DC",
  "CHI": "Chicago, IL",
  "CHICAGO": "Chicago, IL",
  "ATL": "Atlanta, GA",
  "ATLANTA": "Atlanta, GA",
  "SEA": "Seattle, WA",
  "SEATTLE": "Seattle, WA",
  "BOS": "Boston, MA",
  "BOSTON": "Boston, MA",
  "AUSTIN": "Austin, TX",
};

const LEGAL_SUFFIXES = [", Inc", ", LLC", ", Ltd", ", Corp", ", Co.", ".com", " Inc", " LLC", " Ltd", " Corp", " Co."];

export function normalizeJob(raw: RawJob): NormalizedRaw {
  const title = normalizeTitle(raw.title || "");
  const company_name = normalizeCompany(raw.companyName || "");
  const location_name = normalizeLocation(raw.locationName || "");
  const { min: salary_min, max: salary_max, currency: salary_currency } = normalizeSalary(raw.rawData?.salary as string || "");

  // is_remote logic
  const is_remote =
    location_name === "Remote" ||
    (raw.title?.toLowerCase().includes("remote") ?? false) ||
    (raw.description?.toLowerCase().includes("remote") ?? false);

  return {
    title,
    company_name,
    location_name,
    salary_min,
    salary_max,
    salary_currency: salary_currency || "USD",
    is_remote,
  };
}

function normalizeTitle(title: string): string {
  let clean = title.trim();

  // Collapse multiple spaces
  clean = clean.replace(/\s+/g, " ");

  // Strip bracketed suffixes: [Remote], (NYC), etc.
  clean = clean.replace(/[\[\(][^\]\)]*[\]\)]/g, "").trim();

  // Strip duplicated seniority prefixes
  const seniorityPrefixes = ["Senior", "Junior", "Lead", "Staff", "Principal"];
  for (const prefix of seniorityPrefixes) {
    const doublePrefixRegex = new RegExp(`^${prefix}\\s+${prefix}\\s+`, "i");
    if (doublePrefixRegex.test(clean)) {
      clean = clean.replace(new RegExp(`^${prefix}\\s+`, "i"), "");
    }
  }

  clean = clean.trim().replace(/\s+/g, " ");

  if (!clean) return "Unknown Role";

  return clean.length > 200 ? clean.substring(0, 200) : clean;
}

function normalizeCompany(name: string): string {
  let clean = name.trim();

  // Strip leading "The "
  if (clean.toLowerCase().startsWith("the ")) {
    clean = clean.substring(4).trim();
  }

  // Strip legal suffixes (case-insensitive)
  // Sort suffixes by length descending to match longest first (e.g., ", Inc" before " Inc")
  const sortedSuffixes = [...LEGAL_SUFFIXES].sort((a, b) => b.length - a.length);

  for (const suffix of sortedSuffixes) {
    // Escape dots and handle optional trailing dot
    const escaped = suffix.replace(".", "\\.");
    const suffixRegex = new RegExp(`${escaped}\\.?$`, "i");
    if (suffixRegex.test(clean)) {
      clean = clean.replace(suffixRegex, "").trim();
      break; // Only strip one suffix
    }
  }

  clean = clean.replace(/\s+/g, " ");

  return clean || name;
}

function normalizeLocation(loc: string): string {
  const clean = loc.trim();
  const upper = clean.toUpperCase();

  if (upper.includes("REMOTE")) return "Remote";

  if (LOCATION_MAP[upper]) return LOCATION_MAP[upper];

  for (const [abbr, full] of Object.entries(LOCATION_MAP)) {
    if (upper === abbr) return full;
  }

  return clean || "Unknown";
}

function normalizeSalary(salaryStr: string): { min?: number; max?: number; currency?: string } {
  if (!salaryStr) return {};

  const clean = salaryStr.toLowerCase().trim();

  // Detect currency
  let currency = "USD";
  if (clean.includes("£") || clean.includes("gbp")) currency = "GBP";
  else if (clean.includes("€") || clean.includes("eur")) currency = "EUR";
  else if (clean.includes("₹") || clean.includes("inr")) currency = "INR";
  else if (clean.includes("c$") || clean.includes("cad")) currency = "CAD";

  const isHourly = clean.includes("per hour") || clean.includes("/hr") || clean.includes("hourly");

  const parseNum = (s: string, forceK: boolean = false): number | undefined => {
    const match = s.match(/[\d\.,]+/);
    if (!match) return undefined;
    let num = parseFloat(match[0].replace(/,/g, ""));
    if (s.includes("k") || forceK) num *= 1000;
    return isHourly ? num * 2080 : num;
  };

  const parts = clean.split(/[-–—to]/).map(p => p.trim());
  if (parts.length >= 2) {
    const hasKInSecond = parts[1].includes("k");
    const min = parseNum(parts[0], hasKInSecond && !parts[0].includes("k"));
    const max = parseNum(parts[1]);
    return { min, max, currency };
  }

  const val = parseNum(clean);
  return { min: val, max: val, currency };
}
