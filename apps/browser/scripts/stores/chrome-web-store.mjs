// Chrome Web Store API v2: upload the zip to an existing item, wait for the
// package to be processed, then submit it for review with DEFAULT_PUBLISH (it
// goes live as soon as Google approves it). Authenticated as a service account
// added to the publisher (developer.chrome.com/docs/webstore/service-accounts).
import { createSign } from "node:crypto";

import { expectOk, poll } from "./poll.mjs";

const API = "https://chromewebstore.googleapis.com";
const SCOPE = "https://www.googleapis.com/auth/chromewebstore";

const base64url = (value) => Buffer.from(value).toString("base64url");

/** OAuth access token from a service account JSON key (JWT bearer grant). */
export async function serviceAccountToken(key, { fetch = globalThis.fetch } = {}) {
  const tokenUri = key.token_uri ?? "https://oauth2.googleapis.com/token";
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${base64url(
    JSON.stringify({
      iss: key.client_email,
      scope: SCOPE,
      aud: tokenUri,
      iat: now,
      exp: now + 3600,
    }),
  )}`;
  const signature = createSign("RSA-SHA256").update(unsigned).sign(key.private_key, "base64url");
  const response = await fetch(tokenUri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${unsigned}.${signature}`,
    }),
  });
  const body = await expectOk(response, "Google token");
  return body.access_token;
}

export async function publishToChromeWebStore({
  zip,
  version,
  publisherId,
  itemId,
  serviceAccountKey,
  fetch = globalThis.fetch,
  pollOptions,
}) {
  const token = await serviceAccountToken(serviceAccountKey, { fetch });
  const auth = { Authorization: `Bearer ${token}` };
  const item = `publishers/${publisherId}/items/${itemId}`;

  const uploaded = await expectOk(
    await fetch(`${API}/upload/v2/${item}:upload?uploadType=media`, {
      method: "POST",
      headers: { ...auth, "Content-Type": "application/zip" },
      body: zip,
    }),
    "Chrome Web Store upload",
  );
  let state = uploaded.uploadState;
  let crxVersion = uploaded.crxVersion;
  if (state === "IN_PROGRESS") {
    ({ state, crxVersion } = await poll(
      async () => {
        const status = await expectOk(
          await fetch(`${API}/v2/${item}:fetchStatus`, { headers: auth }),
          "Chrome Web Store status",
        );
        const current = status.lastAsyncUploadState;
        return current === "IN_PROGRESS"
          ? { done: false }
          : { done: true, value: { state: current, crxVersion: status.crxVersion ?? crxVersion } };
      },
      { label: "Chrome Web Store upload", ...pollOptions },
    ));
  }
  if (state !== "SUCCEEDED") {
    throw new Error(`Chrome Web Store upload ended in ${state}: ${JSON.stringify(uploaded)}`);
  }
  if (crxVersion !== undefined && crxVersion !== version) {
    throw new Error(`Chrome Web Store received version ${crxVersion}, expected ${version}`);
  }
  console.log(`Chrome Web Store: version ${version} uploaded`);

  const published = await expectOk(
    await fetch(`${API}/v2/${item}:publish`, {
      method: "POST",
      headers: { ...auth, "Content-Type": "application/json" },
      body: JSON.stringify({ publishType: "DEFAULT_PUBLISH" }),
    }),
    "Chrome Web Store publish",
  );
  for (const warning of published.warningInfo?.warnings ?? []) {
    console.log(`Chrome Web Store warning: ${warning.reason} ${warning.description}`);
  }
  console.log(`Chrome Web Store: submitted for review (state ${published.state})`);
  return published.state;
}
