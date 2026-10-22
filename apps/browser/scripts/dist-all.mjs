// Store packages: production builds for Chrome, Edge and Firefox, their zips,
// web-ext lint on the Firefox build, and the source archive AMO requires.
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { join, relative } from "node:path";

import { APP_DIR, BROWSERS, ROOT_DIR, rootVersion } from "../webpack/build-config.mjs";
import { zipBuild } from "./zip-build.mjs";

const run = (command, args, cwd = APP_DIR) =>
  execFileSync(command, args, { cwd, stdio: "inherit", env: process.env });

for (const browser of BROWSERS) {
  run("pnpm", ["exec", "webpack", "--env", `browser=${browser}`, "--env", "target=production"]);
  console.log(relative(process.cwd(), zipBuild({ browser, target: "production" })));
}

run("pnpm", ["run", "lint:firefox"]);

const outDir = join(APP_DIR, "dist");
mkdirSync(outDir, { recursive: true });
const source = join(outDir, `artiforce-source-${rootVersion()}.zip`);
// git archive: exactly the committed tree, nothing from node_modules or builds.
run(
  "git",
  [
    "archive",
    "--format=zip",
    `--prefix=artiforce-extension-${rootVersion()}/`,
    "-o",
    source,
    "HEAD",
  ],
  ROOT_DIR,
);
console.log(relative(process.cwd(), source));
