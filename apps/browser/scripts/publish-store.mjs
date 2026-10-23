// node scripts/publish-store.mjs chrome|edge|firefox --zip <store zip>
//        [--source <source archive>] [--notes <release notes, French>]
//
// Sends one store package of a release to its store and submits it for review.
// Run by .github/workflows/publish.yml; credentials come from the environment
// (docs/release.md lists them). Safari goes through Xcode, not this script.
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { parseArgs } from "node:util";

import { publishToAmo } from "./stores/amo.mjs";
import { publishToChromeWebStore } from "./stores/chrome-web-store.mjs";
import { publishToEdgeAddOns } from "./stores/edge-add-ons.mjs";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    zip: { type: "string" },
    source: { type: "string" },
    notes: { type: "string", default: "Corrections et améliorations." },
  },
});
const [store] = positionals;

function env(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set (docs/release.md, "Store credentials")`);
  }
  return value;
}

/** artiforce-<browser>-production-<version>.zip, as zip-build.mjs names it. */
function versionOf(zip) {
  const match = /^artiforce-[a-z]+-production-(\d+\.\d+\.\d+)\.zip$/.exec(basename(zip));
  if (match === null) {
    throw new Error(`${zip} is not a production store package`);
  }
  return match[1];
}

if (!values.zip) {
  throw new Error("--zip is required");
}
const version = versionOf(values.zip);

switch (store) {
  case "chrome":
    await publishToChromeWebStore({
      zip: readFileSync(values.zip),
      version,
      publisherId: env("CWS_PUBLISHER_ID"),
      itemId: env("CWS_ITEM_ID"),
      serviceAccountKey: JSON.parse(env("CWS_SERVICE_ACCOUNT_KEY")),
    });
    break;
  case "edge":
    await publishToEdgeAddOns({
      zip: readFileSync(values.zip),
      version,
      productId: env("EDGE_PRODUCT_ID"),
      clientId: env("EDGE_CLIENT_ID"),
      apiKey: env("EDGE_API_KEY"),
      notes: `Artiforce ${version}. Same package as the Chrome Web Store listing.`,
    });
    break;
  case "firefox": {
    if (!values.source) {
      throw new Error("--source (the source archive) is required for AMO");
    }
    const sourceDir = mkdtempSync(join(tmpdir(), "artiforce-firefox-"));
    execFileSync("unzip", ["-q", values.zip, "-d", sourceDir], { stdio: "inherit" });
    publishToAmo({
      sourceDir,
      sourceArchive: values.source,
      releaseNotes: values.notes,
      apiKey: env("AMO_JWT_ISSUER"),
      apiSecret: env("AMO_JWT_SECRET"),
    });
    break;
  }
  default:
    throw new Error(`Unknown store "${store}" (expected chrome, edge or firefox)`);
}
