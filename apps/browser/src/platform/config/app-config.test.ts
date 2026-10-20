import { describe, expect, it } from "vitest";

import { loadAppConfig, selectionUrl } from "./app-config";

describe("loadAppConfig", () => {
  it("parses the injected config", () => {
    expect(loadAppConfig().artinovaOrigins).toContain("https://app.artinova.test");
  });

  it("rejects origins with a path or a wildcard", () => {
    const base = {
      artinovaAppUrl: "https://a.fr",
      helpUrl: "https://a.fr/aide",
      selectionPath: "/stock?selection=extension",
    };
    expect(() => loadAppConfig({ ...base, artinovaOrigins: ["https://a.fr/"] })).toThrow();
    expect(() => loadAppConfig({ ...base, artinovaOrigins: ["https://*.a.fr"] })).toThrow();
  });

  it("opens the selection on the Stock page of the web app", () => {
    expect(selectionUrl(loadAppConfig())).toBe(
      "https://app.artinova.test/stock?selection=extension",
    );
  });
});
