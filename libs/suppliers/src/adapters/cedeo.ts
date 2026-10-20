import type { SupplierAdapter } from "./adapter";
import { detectDsbBasis, findDsbAnchor, isDsbProductPage, refineDsb } from "./saint-gobain-dsb";

/** Cedeo (www.cedeo.fr): « Réf. CEDEO » is the supplier code, « Réf. <marque> » the manufacturer's. */
export const cedeoAdapter: SupplierAdapter = {
  supplierId: "cedeo",
  version: 1,
  isProductPage: isDsbProductPage,
  findAnchor: findDsbAnchor,
  refine: refineDsb,
  detectPriceBasis: detectDsbBasis,
};
