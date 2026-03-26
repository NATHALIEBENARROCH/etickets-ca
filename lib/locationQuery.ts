type CountryProfile = {
  label: string;
  countryId: number;
  aliases?: string[];
};

const COUNTRY_PROFILES: CountryProfile[] = [
  { label: "Argentina", countryId: 10 },
  { label: "Australia", countryId: 14 },
  { label: "Canada", countryId: 38 },
  { label: "Chile", countryId: 44, aliases: ["Republic of Chile"] },
  { label: "France", countryId: 71 },
  { label: "Germany", countryId: 77 },
  { label: "Mexico", countryId: 134, aliases: ["United Mexican States"] },
  { label: "New Zealand", countryId: 149 },
  { label: "Spain", countryId: 191, aliases: ["Kingdom of Spain"] },
  {
    label: "United Kingdom",
    countryId: 216,
    aliases: ["UK", "Great Britain", "Britain", "England"],
  },
  {
    label: "United States",
    countryId: 217,
    aliases: ["USA", "US", "United States of America", "America"],
  },
];

function normalizeLookupToken(value: string) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildCountryLookup() {
  const lookup = new Map<string, CountryProfile>();

  for (const profile of COUNTRY_PROFILES) {
    const candidates = new Set<string>([
      profile.label,
      ...(profile.aliases || []),
    ]);

    for (const rawCandidate of candidates) {
      const candidate = normalizeLookupToken(rawCandidate);
      if (!candidate) continue;

      lookup.set(candidate, profile);

      if (candidate.startsWith("the ")) {
        lookup.set(candidate.slice(4), profile);
      }
    }
  }

  return lookup;
}

const COUNTRY_LOOKUP = buildCountryLookup();

export function resolveCountryProfile(location: string) {
  const normalized = normalizeLookupToken(location);
  if (!normalized) return null;
  return COUNTRY_LOOKUP.get(normalized) || null;
}