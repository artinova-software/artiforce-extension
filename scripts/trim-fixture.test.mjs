import { describe, expect, it } from "vitest";

import { TRIM_MARKER } from "./lib/trim-core.mjs";
import { trimHtml, upsertReadmeRow } from "./trim-fixture.mjs";

const PAGE = `<!doctype html><html lang="fr"><head>
  <title>Vis | Shop</title>
  <meta name="viewport" content="width=device-width">
  <meta name="google-site-verification" content="secret">
  <meta property="og:title" content="Vis">
  <link rel="canonical" href="https://shop.example.fr/p/vis">
  <script>trackEverything()</script>
  <script type="application/ld+json">{"@type":"Product","name":"Vis","review":[{"reviewBody":"Long avis"}],"description":"${"x".repeat(400)}"}</script>
</head><body>
  <header><nav>Menu</nav></header>
  <main><section class="product"><h1>Vis inox</h1><p class="desc">${"Texte. ".repeat(80)}</p>
  <img data-src="/v.jpg" style="color:red" onclick="steal()"><button class="cart">Ajouter au panier</button></section></main>
  <footer>Pied</footer>
</body></html>`;

describe("trimHtml", () => {
  const trimmed = trimHtml(PAGE, {
    url: "https://shop.example.fr/p/vis",
    capturedAt: "2026-10-19",
  });

  it("keeps meta, canonical, JSON-LD and the product block with provenance", () => {
    expect(trimmed).toContain(
      "<!-- source: https://shop.example.fr/p/vis | captured: 2026-10-19 |",
    );
    expect(trimmed).toContain(TRIM_MARKER);
    expect(trimmed).toContain('property="og:title"');
    expect(trimmed).toContain('rel="canonical"');
    expect(trimmed).toContain('"@type": "Product"');
    expect(trimmed).toContain("Vis inox");
    expect(trimmed).toContain("Ajouter au panier");
  });

  it("drops scripts, reviews, verification tags, handlers and page chrome, and cuts long text", () => {
    expect(trimmed).not.toMatch(
      /trackEverything|Long avis|google-site-verification|onclick|style=|Menu|Pied/,
    );
    expect(trimmed).not.toContain("x".repeat(200));
    expect(trimmed).not.toContain("Texte. ".repeat(30));
    expect(trimmed).toContain('src="/v.jpg"');
  });

  it("is stable when run again on its own output", () => {
    expect(trimHtml(trimmed, {})).toBe(trimmed);
  });

  it("needs a source URL", () => {
    expect(() => trimHtml(PAGE, {})).toThrow(/source URL/);
  });
});

describe("upsertReadmeRow", () => {
  it("adds or replaces a sorted row", () => {
    const readme =
      "# x\n\n| Supplier | Case | Source | Captured |\n| --- | --- | --- | --- |\n| b | one | u | d |\n";
    const added = upsertReadmeRow(readme, {
      supplier: "a",
      caseName: "one",
      sourceUrl: "https://a",
      capturedAt: "2026-10-19",
    });
    expect(added.trimEnd().split("\n").slice(-2)).toEqual([
      "| a | one | https://a | 2026-10-19 |",
      "| b | one | u | d |",
    ]);
    expect(
      upsertReadmeRow(added, {
        supplier: "a",
        caseName: "one",
        sourceUrl: "https://a2",
        capturedAt: "2026-10-20",
      }),
    ).toContain("| a | one | https://a2 | 2026-10-20 |");
  });
});
