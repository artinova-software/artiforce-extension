import type { SupplierAdapter } from "./adapter";
import { detectDsbBasis, findDsbAnchor, isDsbProductPage, refineDsb } from "./saint-gobain-dsb";

/** Point.P (www.pointp.fr): same storefront as Cedeo; prices often per hundred (« / Cent »). */
export const pointPAdapter: SupplierAdapter = {
  supplierId: "point-p",
  version: 1,
  isProductPage: isDsbProductPage,
  findAnchor: findDsbAnchor,
  refine: refineDsb,
  detectPriceBasis: detectDsbBasis,
};
