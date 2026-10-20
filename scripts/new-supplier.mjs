// pnpm supplier:new <id> --name "Name" --host www.example.fr --segment pro|retail
//                       [--country FR] [--image-host cdn.example.fr]... [--adapter]
//
// One command for a new supplier: the registry entry (sorted), and with
// --adapter an adapter stub, its test and its registration, plus the fixtures
// folder. Next steps: docs/adding-a-supplier.md.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

import {
  adapterSource,
  adapterTestSource,
  buildRecord,
  insertSupplier,
  registerAdapter,
} from "./lib/registry-edit.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SUPPLIERS = join(ROOT, "libs", "suppliers");
const REGISTRY = join(SUPPLIERS, "src", "registry", "suppliers.json");

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    name: { type: "string" },
    host: { type: "string" },
    segment: { type: "string" },
    country: { type: "string", default: "FR" },
    "image-host": { type: "string", multiple: true, default: [] },
    adapter: { type: "boolean", default: false },
  },
});
const [id] = positionals;
if (
  id === undefined ||
  values.name === undefined ||
  values.host === undefined ||
  values.segment === undefined
) {
  console.error(
    'Usage: pnpm supplier:new <id> --name "Name" --host www.example.fr --segment pro|retail [--adapter]',
  );
  process.exit(1);
}

const record = buildRecord({
  id,
  name: values.name,
  host: values.host,
  segment: values.segment,
  country: values.country,
  imageHosts: values["image-host"],
  adapter: values.adapter,
});
const suppliers = insertSupplier(JSON.parse(readFileSync(REGISTRY, "utf8")), record);
writeFileSync(REGISTRY, `${JSON.stringify(suppliers, null, 2)}\n`);
console.log(`Registry: added ${id} (${record.support})`);

if (values.adapter) {
  const adapterPath = join(SUPPLIERS, "src", "adapters", `${id}.ts`);
  if (existsSync(adapterPath)) {
    throw new Error(`${adapterPath} already exists`);
  }
  writeFileSync(adapterPath, adapterSource({ id, name: values.name, host: values.host }));
  writeFileSync(join(SUPPLIERS, "src", "adapters", `${id}.test.ts`), adapterTestSource({ id }));
  const indexPath = join(SUPPLIERS, "src", "adapters", "index.ts");
  writeFileSync(indexPath, registerAdapter(readFileSync(indexPath, "utf8"), id));
  console.log(`Adapter: src/adapters/${id}.ts (+ test, registered)`);
}

mkdirSync(join(SUPPLIERS, "fixtures", id), { recursive: true });
console.log(
  `Fixtures: libs/suppliers/fixtures/${id}/ (pnpm fixture:trim <page.html> --supplier ${id} --case <name>)`,
);
console.log(
  "Then: pnpm format:write && pnpm check. A new host changes the manifest: read ADR-005.",
);
