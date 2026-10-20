import { describe, expect, it } from "vitest";

import { detectBasisInText, parseDecimal, parsePriceText } from "./price";

describe("parseDecimal", () => {
  it.each([
    ["24.90", 2490],
    ["24", 2400],
    ["24,9", 2490],
    ["0.995", 100],
    ["1234.564", 123456],
    [24.9, 2490],
    [0.1 + 0.2, 30],
  ])("reads %j as %i cents", (input, cents) => {
    expect(parseDecimal(input)).toBe(cents);
  });

  it.each([["-1"], ["abc"], [""], [null], [Number.NaN], ["1e5"], ["1 234"]])(
    "refuses %j",
    (input) => {
      expect(parseDecimal(input)).toBeNull();
    },
  );
});

describe("parsePriceText", () => {
  it.each([
    ["24,90 €", 2490],
    ["24,90 €", 2490],
    ["1 234,56 €", 123456],
    ["1 234,56 €", 123456],
    ["1.234,56 €", 123456],
    ["1,234.56 €", 123456],
    ["24€90", 2490],
    ["24 € 90", 2490],
    ["€24,90", 2490],
    ["Prix : 7 €", 700],
    ["Lot de 10 : 24,90 €", 2490],
    ["12,5 EUR", 1250],
    ["3 ,99 € / Lot", 399],
  ])("reads %j as %i cents", (input, cents) => {
    expect(parsePriceText(input)?.cents).toBe(cents);
  });

  it("flags « À partir de » prices as lower bounds", () => {
    expect(parsePriceText("À partir de 9,90 €")).toMatchObject({ cents: 990, lowerBound: true });
    expect(parsePriceText("Dès 9,90 €")?.lowerBound).toBe(true);
    expect(parsePriceText("9,90 €")?.lowerBound).toBe(false);
  });

  it("reads the basis written next to the price", () => {
    expect(parsePriceText("24,90 € HT")?.basis).toBe("HT");
    expect(parsePriceText("24,90 € TTC")?.basis).toBe("TTC");
    expect(parsePriceText("24,90 €")?.basis).toBeNull();
  });

  it("refuses other currencies and empty text", () => {
    expect(parsePriceText("$24.90")).toBeNull();
    expect(parsePriceText("£24.90")).toBeNull();
    expect(parsePriceText("Prix sur demande")).toBeNull();
  });
});

describe("detectBasisInText", () => {
  it.each([
    ["Prix HT", "HT"],
    ["(TTC)", "TTC"],
    ["hors taxes", "HT"],
    ["Toutes taxes comprises", "TTC"],
    ["TVA incluse", "TTC"],
    ["Prix HT / TTC", null],
    ["Prix", null],
    ["Chantier", null],
  ])("%j gives %j", (input, basis) => {
    expect(detectBasisInText(input)).toBe(basis);
  });
});
