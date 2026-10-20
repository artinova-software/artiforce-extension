const TRACKING_PARAMS =
  /^(utm_[a-z]+|gclid|gbraid|wbraid|fbclid|msclkid|dclid|_ga|mc_[a-z]+|cmp|xtor)$/i;

/**
 * Resolves `raw` against `base` and returns an https URL string, or null.
 * `http:` is upgraded (supplier CDNs serve both); other schemes are refused.
 */
export function toHttpsUrl(raw: unknown, base?: string): string | null {
  if (typeof raw !== "string" || raw.trim().length === 0) {
    return null;
  }
  let url: URL;
  try {
    url = new URL(raw.trim(), base);
  } catch {
    return null;
  }
  if (url.protocol === "http:") {
    url.protocol = "https:";
  }
  if (url.protocol !== "https:" || url.username !== "" || url.password !== "") {
    return null;
  }
  return url.href.length <= 2048 ? url.href : null;
}

/** The product URL to store: https, no fragment, no tracking parameters. */
export function canonicalProductUrl(raw: unknown, base?: string): string | null {
  const href = toHttpsUrl(raw, base);
  if (href === null) {
    return null;
  }
  const url = new URL(href);
  url.hash = "";
  for (const key of [...url.searchParams.keys()]) {
    if (TRACKING_PARAMS.test(key)) {
      url.searchParams.delete(key);
    }
  }
  return url.href;
}

export function hostOf(href: string): string | null {
  try {
    return new URL(href).hostname.toLowerCase();
  } catch {
    return null;
  }
}
