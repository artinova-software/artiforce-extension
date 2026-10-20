import type { SupplierAdapter } from "./adapter";
import { manomanoAdapter } from "./manomano";
import { amazonAdapter } from "./amazon";
import { bricoDepotAdapter } from "./brico-depot";
import { castoramaAdapter } from "./castorama";
import { cedeoAdapter } from "./cedeo";
import { ikeaAdapter } from "./ikea";
import { legallaisAdapter } from "./legallais";
import { leroyMerlinAdapter } from "./leroy-merlin";
import { pointPAdapter } from "./point-p";
import { rexelAdapter } from "./rexel";

/** Adapters by supplier id. Suppliers without one use the generic chain only. */
const ADAPTERS: ReadonlyMap<string, SupplierAdapter> = new Map(
  [
    amazonAdapter,
    bricoDepotAdapter,
    castoramaAdapter,
    cedeoAdapter,
    ikeaAdapter,
    legallaisAdapter,
    leroyMerlinAdapter,
    manomanoAdapter,
    pointPAdapter,
    rexelAdapter,
  ].map((adapter) => [adapter.supplierId, adapter]),
);

export function getAdapter(supplierId: string): SupplierAdapter | undefined {
  return ADAPTERS.get(supplierId);
}

export function adapterIds(): string[] {
  return [...ADAPTERS.keys()].sort();
}

export type { SupplierAdapter } from "./adapter";
