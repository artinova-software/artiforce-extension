// Zips one build folder: build/<browser>-<target>/ to
// dist/artinova-<browser>-<target>-<version>.zip (store upload format).
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { parseArgs } from "node:util";

import { zipSync } from "fflate";

import { APP_DIR, resolveBuild } from "../webpack/build-config.mjs";

function listFiles(directory) {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    return statSync(path).isDirectory() ? listFiles(path) : [path];
  });
}

export function zipBuild({ browser, target }) {
  const build = resolveBuild({ browser, target });
  const files = {};
  for (const path of listFiles(build.outDir).sort()) {
    if (path.endsWith(".map") && target === "production") {
      continue;
    }
    // Fixed timestamps: the same build gives the same zip.
    files[relative(build.outDir, path).replaceAll("\\", "/")] = [
      readFileSync(path),
      { mtime: new Date("2026-01-01T00:00:00Z") },
    ];
  }
  if (!("manifest.json" in files)) {
    throw new Error(`${build.outDir} has no manifest.json: build it first`);
  }
  const outDir = join(APP_DIR, "dist");
  mkdirSync(outDir, { recursive: true });
  const outFile = join(outDir, `artinova-${browser}-${target}-${build.version}.zip`);
  writeFileSync(outFile, zipSync(files, { level: 9 }));
  return outFile;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { values } = parseArgs({
    options: {
      browser: { type: "string", default: "chrome" },
      target: { type: "string", default: "production" },
    },
  });
  console.log(relative(process.cwd(), zipBuild(values)));
}
