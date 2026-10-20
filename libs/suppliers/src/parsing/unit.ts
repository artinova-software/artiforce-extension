import type { Unit } from "../model/captured-product";
import { foldForSearch, normalizeSpaces } from "./text";

const END = "(?![a-z0-9])";

/** Ordered: the first match wins (m² before m, ml before m). */
const UNIT_PATTERNS: readonly [RegExp, Unit][] = [
  [new RegExp(`(?:/|\\ble|\\bpar|\\bau)\\s*m(?:²|2)${END}`), "m²"],
  [new RegExp(`(?:/|\\ble|\\bpar|\\bau)\\s*m(?:³|3)${END}`), "m³"],
  [new RegExp(`(?:/\\s*m\\.?l\\.?${END}|metre lineaire|\\bml\\b(?=\\s*$))`), "ml"],
  [new RegExp(`(?:/|\\ble|\\bpar|\\bau)\\s*(?:m|metre)${END}`), "m"],
  [new RegExp(`(?:/|\\ble|\\bpar|\\bau)\\s*kg${END}`), "kg"],
  [new RegExp(`(?:/|\\ble|\\bpar|\\bau)\\s*(?:l|litre)${END}`), "l"],
  [new RegExp(`(?:/|\\bl'|\\bpar|\\bla)\\s*(?:u|unite|piece|pce)${END}`), "u"],
];

const PACK =
  /\b(?:lot|boite|paquet|sachet|carton|pack|colis|rouleau) de (\d{1,5})\b|\bpar (\d{1,5})\b|\bx\s?(\d{1,5})\b/;

/** Reads a selling unit (« /m² », « le m² », « /ml ») from a price label. */
export function detectUnit(text: string): Unit | null {
  const folded = normalizeSpaces(foldForSearch(text));
  for (const [pattern, unit] of UNIT_PATTERNS) {
    if (pattern.test(folded)) {
      return unit;
    }
  }
  return null;
}

/** « Lot de 10 », « boîte de 100 », « x 6 »: the number of pieces sold together. */
export function detectPackagingQuantity(text: string): number | null {
  const match = PACK.exec(normalizeSpaces(foldForSearch(text)));
  if (match === null) {
    return null;
  }
  const value = Number(match[1] ?? match[2] ?? match[3]);
  return Number.isInteger(value) && value > 1 ? value : null;
}
