import { describe, expect, it } from "vitest";

import { normalizeGtin } from "./gtin";

describe("normalizeGtin", () => {
  it.each([
    ["4006381333931", "4006381333931"],
    ["4 006381 333931", "4006381333931"],
    ["96385074", "96385074"],
    ["036000291452", "036000291452"],
    ["10614141000415", "10614141000415"],
    [4006381333931, "4006381333931"],
  ])("accepts %j", (input, expected) => {
    expect(normalizeGtin(input)).toBe(expected);
  });

  it.each([["4006381333932"], ["123"], ["0000000000000"], ["abcdefghijklm"], [null]])(
    "refuses %j",
    (input) => {
      expect(normalizeGtin(input)).toBeNull();
    },
  );
});
