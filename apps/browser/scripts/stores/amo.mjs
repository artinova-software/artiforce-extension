// addons.mozilla.org: `web-ext sign --channel listed` submits a new version of
// the existing listed add-on with its source archive and the reviewer's build
// steps, without waiting for the review (AMO signs and publishes after it).
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { APP_DIR } from "../../webpack/build-config.mjs";

export const AMO_APPROVAL_NOTES = [
  "Node 24.20.0 and pnpm 12.9.1 (corepack enable).",
  "pnpm install --frozen-lockfile",
  "pnpm build:firefox",
  "Output: apps/browser/build/firefox-production (identical to the uploaded package).",
  "Content scripts are not minified; the popup and background bundles are minified by",
  "terser from the TypeScript sources in apps/browser/src and libs/.",
].join("\n");

/** Version metadata for the AMO API: French release notes and the build steps. */
export function amoMetadata({ releaseNotes }) {
  return { version: { release_notes: { fr: releaseNotes }, approval_notes: AMO_APPROVAL_NOTES } };
}

export function publishToAmo({ sourceDir, sourceArchive, releaseNotes, apiKey, apiSecret }) {
  const workDir = mkdtempSync(join(tmpdir(), "artiforce-amo-"));
  const metadata = join(workDir, "metadata.json");
  writeFileSync(metadata, JSON.stringify(amoMetadata({ releaseNotes }), null, 2));
  execFileSync(
    "pnpm",
    [
      "exec",
      "web-ext",
      "sign",
      "--channel=listed",
      `--source-dir=${sourceDir}`,
      `--artifacts-dir=${join(workDir, "artifacts")}`,
      `--upload-source-code=${sourceArchive}`,
      `--amo-metadata=${metadata}`,
      "--approval-timeout=0",
    ],
    {
      cwd: APP_DIR,
      stdio: "inherit",
      // Through the environment, never the command line.
      env: { ...process.env, WEB_EXT_API_KEY: apiKey, WEB_EXT_API_SECRET: apiSecret },
    },
  );
  console.log("AMO: version submitted for review");
}
