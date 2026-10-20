import { describe, expect, it } from "vitest";

import { loadAppConfig } from "./app-config";

describe("loadAppConfig", () => {
  it("parses the injected config", () => {
    expect(loadAppConfig().artinovaOrigins).toContain("https://app.artinova.test");
  });

  it("rejects origins with a path or a wildcard", () => {
    const base = { artinovaAppUrl: "https://a.fr", helpUrl: "https://a.fr/aide" };
    expect(() => loadAppConfig({ ...base, artinovaOrigins: ["https://a.fr/"] })).toThrow();
    expect(() => loadAppConfig({ ...base, artinovaOrigins: ["https://*.a.fr"] })).toThrow();
  });
});
