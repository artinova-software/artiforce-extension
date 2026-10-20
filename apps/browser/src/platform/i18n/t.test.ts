import { describe, expect, it } from "vitest";

import { BrowserApi } from "../browser/browser-api";
import { t } from "./t";

describe("t", () => {
  it("reads French messages with substitutions", () => {
    expect(t("buttonAdd")).toBe("Ajouter à Artinova");
    expect(t("popupExpiresInDays", 3)).toBe("Expire dans 3 jours");
  });
});

describe("BrowserApi.setBadge", () => {
  it("shows the count on the brand blue, nothing at zero", async () => {
    await BrowserApi.setBadge(3);
    expect(chromeFake.badge).toEqual({ text: "3", color: "#2457D6" });
    await BrowserApi.setBadge(0);
    expect(chromeFake.badge.text).toBe("");
    await BrowserApi.setBadge(150);
    expect(chromeFake.badge.text).toBe("99+");
  });
});
