/** Space-like characters French sites put inside prices and labels. */
const SPACES = /[\s\u00a0\u2007\u2009\u202f\u200b]+/g;

/** Collapses every kind of whitespace (NBSP, NNBSP, thin space…) to one space and trims. */
export function normalizeSpaces(value: string): string {
  return value.replace(SPACES, " ").trim();
}

/** Trimmed, single-spaced text, or null when nothing is left. */
export function cleanText(value: unknown, maxLength = 500): string | null {
  if (typeof value !== "string" && typeof value !== "number") {
    return null;
  }
  const text = normalizeSpaces(String(value));
  if (text.length === 0) {
    return null;
  }
  return text.length > maxLength ? `${text.slice(0, maxLength - 1).trimEnd()}…` : text;
}

/** Lowercase, accents removed: for accent-insensitive search and comparisons. */
export function foldForSearch(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase();
}

/** Decodes the few HTML entities that survive in JSON-LD strings. */
export function decodeEntities(value: string): string {
  return value.replace(/&(#x?[0-9a-f]+|amp|quot|apos|lt|gt|nbsp);/gi, (match, entity: string) => {
    const lower = entity.toLowerCase();
    const named: Record<string, string> = {
      amp: "&",
      quot: '"',
      apos: "'",
      lt: "<",
      gt: ">",
      nbsp: " ",
    };
    if (lower in named) {
      return named[lower] ?? match;
    }
    const code = lower.startsWith("#x")
      ? Number.parseInt(lower.slice(2), 16)
      : Number.parseInt(lower.slice(1), 10);
    return Number.isFinite(code) && code > 0 && code < 0x110000
      ? String.fromCodePoint(code)
      : match;
  });
}
