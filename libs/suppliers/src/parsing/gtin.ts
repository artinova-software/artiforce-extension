/** GS1 check digit over every digit but the last. */
function hasValidCheckDigit(digits: string): boolean {
  let sum = 0;
  const body = digits.slice(0, -1);
  for (let index = 0; index < body.length; index += 1) {
    const digit = Number(body[body.length - 1 - index]);
    sum += index % 2 === 0 ? digit * 3 : digit;
  }
  const check = (10 - (sum % 10)) % 10;
  return check === Number(digits[digits.length - 1]);
}

/**
 * A GTIN-8, -12, -13 or -14 with a valid check digit, digits only; null otherwise.
 * Spaces and dashes are tolerated in the input.
 */
export function normalizeGtin(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number") {
    return null;
  }
  const digits = String(value).replace(/[\s-]/g, "");
  if (!/^\d+$/.test(digits) || ![8, 12, 13, 14].includes(digits.length)) {
    return null;
  }
  if (/^0+$/.test(digits)) {
    return null;
  }
  return hasValidCheckDigit(digits) ? digits : null;
}
