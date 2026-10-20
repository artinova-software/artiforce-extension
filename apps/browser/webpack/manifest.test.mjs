import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  activeSuppliers as tsActiveSuppliers,
  listedSuppliers as tsListedSuppliers,
  contentScriptMatches as tsContentScriptMatches,
  hostPermissions as tsHostPermissions,
} from "@artinova-software/extension-suppliers";
import { loadAppConfig, originMatchPattern, validateAppConfig } from "./app-config.mjs";
import { APP_DIR, rootVersion } from "./build-config.mjs";
import { buildManifest, flattenBrowserKeys } from "./manifest.mjs";
import {
  activeSuppliers,
  contentScriptMatches,
  hostPermissions,
  listedSuppliers,
} from "./suppliers.mjs";

const template = JSON.parse(readFileSync(join(APP_DIR, "src", "manifest.json"), "utf8"));
const messages = JSON.parse(
  readFileSync(join(APP_DIR, "src", "_locales", "fr", "messages.json"), "utf8"),
);

function manifestFor(browser, target) {
  return buildManifest(template, {
    browser,
    target,
    version: rootVersion(),
    appConfig: loadAppConfig(target),
    devKey: "DEV-KEY",
  });
}

describe("buildManifest", () => {
  it.each(["chrome", "firefox"])("matches the %s production snapshot", (browser) => {
    expect(manifestFor(browser, "production")).toMatchSnapshot();
  });

  it("gives Edge the Chrome manifest", () => {
    expect(manifestFor("edge", "production")).toEqual(manifestFor("chrome", "production"));
  });

  it("uses a service worker on Chrome and background scripts on Firefox", () => {
    expect(manifestFor("chrome", "production").background).toEqual({
      service_worker: "background.js",
    });
    expect(manifestFor("firefox", "production").background).toEqual({ scripts: ["background.js"] });
    expect(manifestFor("firefox", "production").browser_specific_settings.gecko.id).toBe(
      "browser-extension@artinova.fr",
    );
  });

  it("grants the hosts of disabled suppliers but injects nothing there", () => {
    const disabled = listedSuppliers().filter((supplier) => supplier.support === "disabled");
    const manifest = manifestFor("chrome", "production");
    for (const supplier of disabled) {
      for (const site of supplier.sites) {
        expect(manifest.host_permissions).toContain(`https://${site.host}/*`);
        expect(manifest.content_scripts[0].matches.join(" ")).not.toContain(`//${site.host}/`);
      }
    }
  });

  it("asks for storage, unlimitedStorage and alarms only", () => {
    expect(manifestFor("chrome", "production").permissions).toEqual([
      "storage",
      "unlimitedStorage",
      "alarms",
    ]);
  });

  it("keeps localhost, staging and test hosts out of production", () => {
    for (const browser of ["chrome", "firefox"]) {
      const text = JSON.stringify(manifestFor(browser, "production"));
      expect(text).not.toMatch(/localhost|staging|\.test\b/);
      expect(manifestFor(browser, "production").key).toBeUndefined();
    }
  });

  it("adds the development key and the test shop to the e2e target", () => {
    const manifest = manifestFor("chrome", "e2e");
    expect(manifest.key).toBe("DEV-KEY");
    expect(manifest.content_scripts[0].matches).toContain("https://shop.artinova.test/*");
    expect(manifest.host_permissions).toContain("https://img.artinova.test/*");
    expect(manifest.content_scripts[1].matches).toEqual(["https://app.artinova.test/*"]);
  });

  it("loads the bridge at document_start on the Artinova origins", () => {
    const bridge = manifestFor("chrome", "development").content_scripts[1];
    expect(bridge.run_at).toBe("document_start");
    expect(bridge.matches).toEqual(["http://localhost/*", "https://staging.artinova.fr/*"]);
  });

  it("takes the version from the root package.json", () => {
    expect(manifestFor("chrome", "production").version).toBe(rootVersion());
  });
});

describe("locales", () => {
  it("defines every __MSG_*__ the manifest uses", () => {
    const keys = [...JSON.stringify(template).matchAll(/__MSG_(\w+)__/g)].map((match) => match[1]);
    expect(keys.length).toBeGreaterThan(0);
    for (const key of keys) {
      expect(messages).toHaveProperty(key);
    }
  });

  it("fits the store limits and avoids em dashes", () => {
    expect(messages.extName.message.length).toBeLessThanOrEqual(40);
    expect(messages.extDescription.message.length).toBeLessThanOrEqual(132);
    for (const [key, entry] of Object.entries(messages)) {
      expect(entry.message, key).not.toMatch(/—/);
    }
  });
});

describe("flattenBrowserKeys", () => {
  it("prefers the exact browser, falls back from Edge to Chrome", () => {
    const value = { a: 1, __chrome__b: "c", __edge__b: "e", __firefox__d: "f" };
    expect(flattenBrowserKeys(value, "chrome")).toEqual({ a: 1, b: "c" });
    expect(flattenBrowserKeys(value, "edge")).toEqual({ a: 1, b: "e" });
    expect(flattenBrowserKeys(value, "firefox")).toEqual({ a: 1, d: "f" });
  });
});

describe("app config", () => {
  it("refuses localhost and staging in production", () => {
    expect(() =>
      validateAppConfig(
        {
          artinovaOrigins: ["http://localhost:3000"],
          artinovaAppUrl: "http://localhost:3000",
          helpUrl: "https://a.fr",
        },
        "production",
      ),
    ).toThrow(/production/);
    expect(() => loadAppConfig("production")).not.toThrow();
  });

  it("drops the port from localhost match patterns (Firefox)", () => {
    expect(originMatchPattern("http://localhost:3000")).toBe("http://localhost/*");
  });
});

describe("registry helpers", () => {
  it("agree with libs/suppliers", () => {
    for (const includeTestOnly of [false, true]) {
      const mjs = activeSuppliers({ includeTestOnly });
      const ts = tsActiveSuppliers({ includeTestOnly });
      expect(mjs.map((supplier) => supplier.id)).toEqual(ts.map((supplier) => supplier.id));
      expect(contentScriptMatches(mjs)).toEqual(tsContentScriptMatches(ts));
      expect(hostPermissions(mjs)).toEqual(tsHostPermissions(ts));
      expect(listedSuppliers({ includeTestOnly }).map((supplier) => supplier.id)).toEqual(
        tsListedSuppliers({ includeTestOnly }).map((supplier) => supplier.id),
      );
    }
  });
});
