import { describe, expect, it } from "vitest";

import { canonicalProductUrl, toHttpsUrl } from "./url";

describe("toHttpsUrl", () => {
  it("resolves relative and protocol-relative URLs", () => {
    expect(toHttpsUrl("//media.adeo.com/a.jpg", "https://www.leroymerlin.fr/p")).toBe(
      "https://media.adeo.com/a.jpg",
    );
    expect(toHttpsUrl("/a.jpg", "https://shop.example.fr/p/1")).toBe(
      "https://shop.example.fr/a.jpg",
    );
  });

  it("upgrades http and refuses other schemes", () => {
    expect(toHttpsUrl("http://cdn.example.fr/a.jpg")).toBe("https://cdn.example.fr/a.jpg");
    expect(toHttpsUrl("javascript:alert(1)")).toBeNull();
    expect(toHttpsUrl("data:image/png;base64,AAAA")).toBeNull();
    expect(toHttpsUrl("https://user:pass@example.fr/")).toBeNull();
    expect(toHttpsUrl("")).toBeNull();
  });
});

describe("canonicalProductUrl", () => {
  it("drops the fragment and tracking parameters, keeps the others", () => {
    expect(
      canonicalProductUrl("https://www.example.fr/p/1.html?utm_source=x&gclid=y&ref=3#avis"),
    ).toBe("https://www.example.fr/p/1.html?ref=3");
  });
});
