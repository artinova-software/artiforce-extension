import { describe, expect, it } from "vitest";

import { loadAppConfig, selectionUrl } from "./app-config";

describe("loadAppConfig", () => {
  it("parses the injected config", () => {
    expect(loadAppConfig().artiforceOrigins).toContain("https://app.artiforce.test");
  });

  it("rejects origins with a path or a wildcard", () => {
    const base = {
      artiforceAppUrl: "https://a.fr",
      helpUrl: "https://a.fr/aide",
      selectionPath: "/stock?selection=extension",
    };
    expect(() => loadAppConfig({ ...base, artiforceOrigins: ["https://a.fr/"] })).toThrow();
    expect(() => loadAppConfig({ ...base, artiforceOrigins: ["https://*.a.fr"] })).toThrow();
  });

  it("opens the selection on the Stock page of the web app", () => {
    expect(selectionUrl(loadAppConfig())).toBe(
      "https://app.artiforce.test/stock?selection=extension",
    );
  });
});
