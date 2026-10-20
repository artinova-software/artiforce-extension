import { describe, expect, it } from "vitest";

import { listFixtures, loadFixture } from "../../test/load-fixture";
import { extractProduct, findAnchor, isProductPage } from "../extraction/extract-product";
import { createProductPage } from "../extraction/product-page";
import { getSupplier, isAllowedImageHost } from "../registry/registry";

const fixtures = listFixtures();

describe("supplier fixtures", () => {
  it("exist", () => {
    expect(fixtures.length).toBeGreaterThan(0);
  });

  describe.each(
    fixtures.map((fixture) => [`${fixture.supplierId}/${fixture.caseName}`, fixture] as const),
  )("%s", (_name, fixture) => {
    const supplier = getSupplier(fixture.supplierId);

    it("belongs to a registered supplier", () => {
      expect(supplier).toBeDefined();
    });

    if (supplier === undefined) {
      return;
    }
    const page = () => createProductPage(loadFixture(fixture), supplier);

    it("is recognised as a product page", () => {
      expect(isProductPage(page())).toBe(true);
    });

    if (supplier.support === "verified") {
      it("has an anchor for the button", () => {
        expect(findAnchor(page())).not.toBeNull();
      });
    }

    it("extracts the expected product", async () => {
      const result = extractProduct(page());
      expect(result.ok, JSON.stringify(result)).toBe(true);
      await expect(`${JSON.stringify(result, null, 2)}\n`).toMatchFileSnapshot(
        `./__expected__/${fixture.supplierId}/${fixture.caseName}.json`,
      );
    });

    it("downloads its image from a declared host", () => {
      const result = extractProduct(page());
      if (result.ok && result.product.imageUrl !== null) {
        expect(isAllowedImageHost(supplier, new URL(result.product.imageUrl).hostname)).toBe(true);
      }
    });
  });
});
