import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { JSDOM } from "jsdom";

export const FIXTURES_DIR = join(import.meta.dirname, "..", "fixtures");

export type Fixture = { supplierId: string; caseName: string; path: string; url: string };

/** Every `fixtures/<supplier-id>/<case>.html`, with the URL from its provenance comment. */
export function listFixtures(): Fixture[] {
  return readdirSync(FIXTURES_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((directory) =>
      readdirSync(join(FIXTURES_DIR, directory.name))
        .filter((file) => file.endsWith(".html"))
        .map((file) => {
          const path = join(FIXTURES_DIR, directory.name, file);
          const match = /<!-- source: (\S+) \|/.exec(readFileSync(path, "utf8"));
          if (match?.[1] === undefined) {
            throw new Error(`${path}: missing provenance comment`);
          }
          return {
            supplierId: directory.name,
            caseName: file.replace(/\.html$/, ""),
            path,
            url: match[1],
          };
        }),
    );
}

export function loadDocument(html: string, url: string): Document {
  return new JSDOM(html, { url }).window.document;
}

export function loadFixture(fixture: Fixture): Document {
  return loadDocument(readFileSync(fixture.path, "utf8"), fixture.url);
}
