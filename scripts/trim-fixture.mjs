// pnpm fixture:trim <page.html> --supplier <id> --case <name> [--url <source>] [--keep <selector>]...
//
// Trims a saved product page into libs/suppliers/fixtures/<id>/<case>.html and
// records it in the fixtures README. The page can come from "Save as" in a
// browser, or from trimDocument run in the devtools console on sites that
// block scripts (docs/adding-a-supplier.md).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

import { JSDOM } from "jsdom";

import { readProvenance, TRIM_MARKER, trimDocument } from "./lib/trim-core.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FIXTURES = join(ROOT, "libs", "suppliers", "fixtures");

/** Trims `html`; an already trimmed page keeps its whole body unless selectors are given. */
export function trimHtml(html, { url, keep = [], capturedAt }) {
  const provenance = readProvenance(html);
  const sourceUrl = url ?? provenance?.sourceUrl;
  if (sourceUrl === undefined) {
    throw new Error("No source URL: pass --url (the page has no provenance comment)");
  }
  const alreadyTrimmed = html.includes(TRIM_MARKER);
  const dom = new JSDOM(html, { url: sourceUrl });
  return trimDocument(dom.window.document, {
    sourceUrl,
    capturedAt: capturedAt ?? provenance?.capturedAt,
    keep: keep.length > 0 ? keep : alreadyTrimmed ? ["body > *"] : [],
    firstOnly: !(alreadyTrimmed && keep.length === 0),
  });
}

/** Adds or replaces the README row for this fixture, keeping rows sorted. */
export function upsertReadmeRow(readme, { supplier, caseName, sourceUrl, capturedAt }) {
  const row = `| ${supplier} | ${caseName} | ${sourceUrl} | ${capturedAt} |`;
  const lines = readme.trimEnd().split("\n");
  const header = lines.findIndex((line) => line.startsWith("| --- |"));
  if (header === -1) {
    throw new Error("Fixtures README has no table");
  }
  const rows = lines
    .slice(header + 1)
    .filter((line) => line.startsWith("|") && !line.startsWith(`| ${supplier} | ${caseName} |`));
  rows.push(row);
  rows.sort();
  return `${[...lines.slice(0, header + 1), ...rows].join("\n")}\n`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      supplier: { type: "string" },
      case: { type: "string" },
      url: { type: "string" },
      keep: { type: "string", multiple: true, default: [] },
      date: { type: "string" },
    },
  });
  const [input] = positionals;
  if (input === undefined || values.supplier === undefined || values.case === undefined) {
    console.error(
      "Usage: pnpm fixture:trim <page.html> --supplier <id> --case <name> [--url <source>] [--keep <selector>]...",
    );
    process.exit(1);
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(values.case)) {
    throw new Error("--case must be kebab-case");
  }
  const trimmed = trimHtml(readFileSync(input, "utf8"), {
    url: values.url,
    keep: values.keep,
    capturedAt: values.date,
  });
  const directory = join(FIXTURES, values.supplier);
  mkdirSync(directory, { recursive: true });
  const target = join(directory, `${values.case}.html`);
  writeFileSync(target, trimmed);
  const provenance = readProvenance(trimmed);
  const readmePath = join(FIXTURES, "README.md");
  if (existsSync(readmePath) && provenance !== null) {
    writeFileSync(
      readmePath,
      upsertReadmeRow(readFileSync(readmePath, "utf8"), {
        supplier: values.supplier,
        caseName: values.case,
        ...provenance,
      }),
    );
  }
  console.log(`${relative(process.cwd(), target)} (${Buffer.byteLength(trimmed)} bytes)`);
  console.log("Next: pnpm vitest run --project suppliers -u, then review __expected__.");
}
