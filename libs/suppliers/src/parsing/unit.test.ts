import { describe, expect, it } from "vitest";

import { detectPackagingQuantity, detectUnit } from "./unit";

describe("detectUnit", () => {
  it.each([
    ["24,90 € /m²", "m²"],
    ["24,90 € le m2", "m²"],
    ["Prix au m³", "m³"],
    ["3,20 € / ml", "ml"],
    ["3,20 € le mètre", "m"],
    ["12 € / kg", "kg"],
    ["8 € le litre", "l"],
    ["2 € / u", "u"],
    ["2 € l'unité", "u"],
    ["24,90 €", null],
    ["Lot de 10", null],
  ])("%j gives %j", (input, unit) => {
    expect(detectUnit(input)).toBe(unit);
  });
});

describe("detectPackagingQuantity", () => {
  it.each([
    ["Lot de 10 vis", 10],
    ["Boîte de 100", 100],
    ["Vendu par 6", 6],
    ["Pack x 12", 12],
    ["Lot de 1", null],
    ["Vis 4x40", null],
    ["Vis inox", null],
  ])("%j gives %j", (input, quantity) => {
    expect(detectPackagingQuantity(input)).toBe(quantity);
  });
});
