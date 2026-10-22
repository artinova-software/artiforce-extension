// Watch build for Chrome (development target) and loading instructions.
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join, relative } from "node:path";

import { APP_DIR, resolveBuild } from "../webpack/build-config.mjs";

/** Chrome derives the extension ID from the manifest key: sha256, first 16 bytes, a-p. */
export function extensionIdFromKey(base64Key) {
  const hash = createHash("sha256").update(Buffer.from(base64Key, "base64")).digest("hex");
  return [...hash.slice(0, 32)]
    .map((digit) => String.fromCharCode(97 + Number.parseInt(digit, 16)))
    .join("");
}

const build = resolveBuild({ browser: "chrome", target: "development" });
const key = readFileSync(join(APP_DIR, "config", "dev-manifest-key.txt"), "utf8").trim();

console.log(`
Artiforce extension, development build (watch mode)

  1. Open chrome://extensions and enable Developer mode.
  2. Load unpacked: ${relative(process.cwd(), build.outDir) || build.outDir}
  3. Extension ID (stable, from config/dev-manifest-key.txt): ${extensionIdFromKey(key)}
  4. After a rebuild, reload the extension card, then the supplier tab.
`);

spawn(
  "pnpm",
  ["exec", "webpack", "--watch", "--env", "browser=chrome", "--env", "target=development"],
  {
    cwd: APP_DIR,
    stdio: "inherit",
  },
);
