import { readFileSync } from "node:fs";
import { join } from "node:path";

import { APP_DIR } from "./build-config.mjs";

const ORIGIN = /^(https:\/\/[a-z0-9.-]+|http:\/\/localhost(:\d+)?)$/;

/** config/base.json merged with config/<target>.json, checked before it is injected. */
export function loadAppConfig(target) {
  const read = (name) => JSON.parse(readFileSync(join(APP_DIR, "config", `${name}.json`), "utf8"));
  const config = { ...read("base"), ...read(target) };
  validateAppConfig(config, target);
  return config;
}

export function validateAppConfig(config, target) {
  const errors = [];
  if (!Array.isArray(config.artinovaOrigins) || config.artinovaOrigins.length === 0) {
    errors.push("artinovaOrigins must be a non-empty array");
  } else {
    for (const origin of config.artinovaOrigins) {
      if (!ORIGIN.test(origin)) {
        errors.push(`artinovaOrigins: "${origin}" is not a bare https (or localhost) origin`);
      }
    }
  }
  for (const key of ["artinovaAppUrl", "helpUrl"]) {
    if (typeof config[key] !== "string" || !/^https?:\/\//.test(config[key])) {
      errors.push(`${key} must be an absolute URL`);
    }
  }
  if (typeof config.selectionPath !== "string" || !/^\/[^/]/.test(config.selectionPath)) {
    errors.push("selectionPath must be a path on the web app, e.g. /stock?selection=extension");
  }
  if (target === "production") {
    const all = [...(config.artinovaOrigins ?? []), config.artinovaAppUrl];
    for (const value of all) {
      if (/localhost|staging|\.test\b|^http:/.test(value)) {
        errors.push(`production config must not reference "${value}"`);
      }
    }
  }
  if (errors.length > 0) {
    throw new Error(`Invalid app config for target "${target}":\n- ${errors.join("\n- ")}`);
  }
}

/** Match pattern for an origin; localhost without a port, as Firefox requires. */
export function originMatchPattern(origin) {
  const url = new URL(origin);
  return `${url.protocol}//${url.hostname}/*`;
}
