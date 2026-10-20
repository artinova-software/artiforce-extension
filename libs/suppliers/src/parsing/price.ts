import { PriceBasis } from "../model/price-basis";
import { foldForSearch, normalizeSpaces } from "./text";

export type ParsedPrice = {
  cents: number;
  /** A « À partir de » price: a lower bound, not the price of this product. */
  lowerBound: boolean;
  /** HT/TTC when the label says so, null otherwise. */
  basis: PriceBasis | null;
};

const MAX_CENTS = 100_000_000;

/** Integer cents from an integer part and a decimal part, rounding half up on the third digit. */
function toCents(integerPart: string, fraction: string): number | null {
  const integer = integerPart.replace(/\D/g, "");
  if (integer.length === 0 || integer.length > 9) {
    return null;
  }
  const padded = `${fraction}000`;
  let cents = Number(integer) * 100 + Number(padded.slice(0, 2));
  if (Number(padded[2]) >= 5) {
    cents += 1;
  }
  return cents <= MAX_CENTS ? cents : null;
}

/**
 * A machine price (`"24.90"`, `"24"`, `24.9`, `"24,90"` from careless JSON-LD) to
 * integer cents. The value is read as a string: no float arithmetic.
 */
export function parseDecimal(value: unknown): number | null {
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value < 0) {
      return null;
    }
    return parseDecimal(value.toFixed(3));
  }
  if (typeof value !== "string") {
    return null;
  }
  const match = /^\s*(\d+)(?:[.,](\d+))?\s*$/.exec(value);
  if (match === null) {
    return null;
  }
  return toCents(match[1] ?? "", match[2] ?? "");
}

const AMOUNT =
  /(?<![\d.,])(\d{1,3}(?:[ .,]\d{3})+|\d+)(?:[.,](\d{1,2}))?(?!\d)(?:\s?€\s?(\d{2})(?!\d))?/g;

/** The amount closest to a euro sign: « Lot de 10 : 24,90 € » is 24,90, not 10. */
function pickAmount(text: string): RegExpExecArray | null {
  const matches = [...text.matchAll(AMOUNT)];
  const nearEuro = matches.find((match) => {
    const before = text.slice(Math.max(0, match.index - 2), match.index);
    const after = text.slice(match.index + match[0].length, match.index + match[0].length + 4);
    return match[0].includes("€") || /€\s?$/.test(before) || /^\s?(?:€|eur\b)/i.test(after);
  });
  return (nearEuro ?? matches[0] ?? null) as RegExpExecArray | null;
}

/** HT or TTC when the text says so explicitly. */
export function detectBasisInText(text: string): PriceBasis | null {
  const folded = ` ${foldForSearch(normalizeSpaces(text))} `;
  const ttc = /[\s(/]ttc[\s).,*]|toutes taxes comprises|tva incluse|tva comprise/.test(folded);
  const ht = /[\s(/]ht[\s).,*]|hors taxes?|hors tva|h\.t\./.test(folded);
  if (ttc && !ht) {
    return PriceBasis.TTC;
  }
  if (ht && !ttc) {
    return PriceBasis.HT;
  }
  return null;
}

/**
 * A displayed price (« 1 234,56 € », « 1.234,56 € », « 24€90 », « À partir de 9,90 € HT »)
 * to integer cents. Non-euro currencies are refused.
 */
export function parsePriceText(raw: string): ParsedPrice | null {
  // « 3 ,99 € » (integer and decimals in separate elements) reads as « 3,99 € ».
  const text = normalizeSpaces(raw).replace(/(\d) ([.,]\d)/g, "$1$2");
  if (/[$£¥]|\b(?:usd|gbp|chf)\b/i.test(text)) {
    return null;
  }
  const match = pickAmount(text);
  if (match === null) {
    return null;
  }
  const [, integerPart = "", decimals, splitDecimals] = match;
  const cents = toCents(integerPart, decimals ?? splitDecimals ?? "");
  if (cents === null) {
    return null;
  }
  const before = foldForSearch(text.slice(0, match.index));
  return {
    cents,
    lowerBound: /\ba partir d|^\s*des\b|\bdes\s*$/.test(before),
    basis: detectBasisInText(text),
  };
}
