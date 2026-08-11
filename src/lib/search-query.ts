/**
 * Expands a shopper search into the typed query plus corrected / synonym forms
 * so common jewellery misspellings still hit the catalog.
 */

/** Explicit corrections for frequent typos and short forms. */
const CORRECTIONS: Record<string, string> = {
  // Categories / product types
  earing: "earring",
  earings: "earrings",
  earrng: "earring",
  earrin: "earring",
  neklace: "necklace",
  neckace: "necklace",
  necklase: "necklace",
  necklaces: "necklace",
  pendemt: "pendant",
  pendnat: "pendant",
  bracelete: "bracelet",
  braclet: "bracelet",
  bracelate: "bracelet",
  bangal: "bangle",
  bangels: "bangles",
  ancklet: "anklet",
  ancklets: "anklets",
  ringg: "ring",
  rings: "ring",
  stud: "studs",
  // Stones / finishes
  diamnd: "diamond",
  diamon: "diamond",
  cubiz: "cubic",
  zirconi: "zirconia",
  ziroconia: "zirconia",
  emrald: "emerald",
  emereld: "emerald",
  sapphirre: "sapphire",
  saphire: "sapphire",
  kundun: "kundan",
  polkee: "polki",
  // Brand / collection shorthand
  bridal: "bridal",
  bride: "bridal",
  everyday: "everyday",
  layer: "layering",
  layering: "layering",
  hoop: "hoops",
  tennis: "tennis",
  solitair: "solitaire",
  solitare: "solitaire",
  solitiare: "solitaire",
};

/** Catalog vocabulary used for fuzzy (edit-distance) matching. */
const VOCABULARY = [
  "earring",
  "earrings",
  "necklace",
  "necklaces",
  "pendant",
  "pendants",
  "bracelet",
  "bracelets",
  "bangle",
  "bangles",
  "anklet",
  "anklets",
  "ring",
  "rings",
  "studs",
  "hoops",
  "chain",
  "brooch",
  "kundan",
  "polki",
  "bridal",
  "everyday",
  "layering",
  "solitaire",
  "tennis",
  "cubic",
  "zirconia",
  "emerald",
  "sapphire",
  "crystal",
  "gold",
  "plated",
  "silver",
  "rose",
] as const;

const MAX_EDIT_DISTANCE = 2;

function normalizeToken(token: string) {
  return token.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Classic Levenshtein distance — fine for short jewellery tokens. */
export function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const prev = new Array<number>(b.length + 1);
  const curr = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j]!;
  }
  return prev[b.length]!;
}

function fuzzyMatch(token: string): string | null {
  if (token.length < 3) return null;

  let best: string | null = null;
  let bestDistance = Infinity;

  for (const word of VOCABULARY) {
    // Skip wildly different lengths — cheap filter before edit distance.
    if (Math.abs(word.length - token.length) > MAX_EDIT_DISTANCE) continue;
    const distance = editDistance(token, word);
    if (distance > 0 && distance <= MAX_EDIT_DISTANCE && distance < bestDistance) {
      best = word;
      bestDistance = distance;
    }
  }

  return best;
}

/**
 * Returns unique search terms derived from the raw query: the original string,
 * per-token corrections, and a fully corrected phrase when tokens change.
 */
export function expandSearchTerms(query: string): string[] {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const terms = new Set<string>([trimmed]);
  const tokens = trimmed.split(/\s+/).map(normalizeToken).filter(Boolean);
  const correctedTokens: string[] = [];

  for (const token of tokens) {
    const explicit = CORRECTIONS[token];
    const fuzzy = explicit ? null : fuzzyMatch(token);
    const corrected = explicit ?? fuzzy ?? token;
    correctedTokens.push(corrected);

    if (corrected !== token) {
      terms.add(corrected);
      // Plural / singular helpers for category words.
      if (corrected.endsWith("s")) terms.add(corrected.slice(0, -1));
      else terms.add(`${corrected}s`);
    }
  }

  const correctedPhrase = correctedTokens.join(" ");
  if (correctedPhrase && correctedPhrase.toLowerCase() !== trimmed.toLowerCase()) {
    terms.add(correctedPhrase);
  }

  return [...terms].filter((term) => term.length >= 2).slice(0, 12);
}

/** Prisma OR clauses shared by shop search and typeahead. */
export function productSearchClauses(
  query: string,
  options: { includeDescription?: boolean } = {},
) {
  const { includeDescription = true } = options;
  const terms = expandSearchTerms(query);
  return terms.flatMap((term) => {
    const clauses = [
      { name: { contains: term, mode: "insensitive" as const } },
      { shortDescription: { contains: term, mode: "insensitive" as const } },
      { gemstone: { contains: term, mode: "insensitive" as const } },
      {
        collections: {
          some: {
            collection: { name: { contains: term, mode: "insensitive" as const } },
          },
        },
      },
    ];
    if (includeDescription) {
      clauses.splice(2, 0, {
        description: { contains: term, mode: "insensitive" as const },
      });
    }
    return clauses;
  });
}
