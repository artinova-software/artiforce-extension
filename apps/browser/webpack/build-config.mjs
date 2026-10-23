import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const APP_DIR = join(dirname(fileURLToPath(import.meta.url)), "..");
export const ROOT_DIR = join(APP_DIR, "..", "..");

export const BROWSERS = ["chrome", "edge", "firefox", "safari"];
export const TARGETS = ["development", "staging", "production", "e2e"];

/** `--env browser=chrome --env target=production` to a validated build description. */
export function resolveBuild(env = {}) {
  const browser = env.browser ?? "chrome";
  const target = env.target ?? "development";
  if (!BROWSERS.includes(browser)) {
    throw new Error(`Unknown browser "${browser}" (expected ${BROWSERS.join(", ")})`);
  }
  if (!TARGETS.includes(target)) {
    throw new Error(`Unknown target "${target}" (expected ${TARGETS.join(", ")})`);
  }
  return {
    browser,
    target,
    isDev: target === "development",
    outDir: join(APP_DIR, "build", `${browser}-${target}`),
    version: rootVersion(),
  };
}

/** The repository version (root package.json): the only source of truth. */
export function rootVersion() {
  return JSON.parse(readFileSync(join(ROOT_DIR, "package.json"), "utf8")).version;
}
