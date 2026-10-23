// Microsoft Edge Add-ons API v1.1: upload the zip as the draft of an existing
// product, wait for it, then publish the draft (certification, then live).
// learn.microsoft.com/microsoft-edge/extensions/update/api/using-addons-api
import { expectOk, poll, readBody } from "./poll.mjs";

const API = "https://api.addons.microsoftedge.microsoft.com/v1";

/** The operation ID is the last segment of the 202 response Location header. */
export function operationId(response, label) {
  const location = response.headers.get("location");
  if (response.status !== 202 || !location) {
    throw new Error(`${label}: expected 202 with a Location header, got HTTP ${response.status}`);
  }
  return location.split("/").filter(Boolean).at(-1);
}

async function waitForOperation(url, headers, label, fetch, pollOptions) {
  const result = await poll(
    async () => {
      const body = await expectOk(await fetch(url, { headers }), label);
      return body.status === "InProgress" ? { done: false } : { done: true, value: body };
    },
    { label, ...pollOptions },
  );
  if (result.status !== "Succeeded") {
    throw new Error(`${label} ended in ${result.status}: ${JSON.stringify(result)}`);
  }
  return result;
}

export async function publishToEdgeAddOns({
  zip,
  version,
  productId,
  clientId,
  apiKey,
  notes,
  fetch = globalThis.fetch,
  pollOptions,
}) {
  const headers = { Authorization: `ApiKey ${apiKey}`, "X-ClientID": clientId };
  const product = `${API}/products/${productId}`;

  const upload = await fetch(`${product}/submissions/draft/package`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/zip" },
    body: zip,
  });
  if (upload.status !== 202) {
    throw new Error(`Edge upload: HTTP ${upload.status} ${JSON.stringify(await readBody(upload))}`);
  }
  const uploadId = operationId(upload, "Edge upload");
  await waitForOperation(
    `${product}/submissions/draft/package/operations/${uploadId}`,
    headers,
    "Edge upload",
    fetch,
    pollOptions,
  );
  console.log(`Edge Add-ons: version ${version} uploaded to the draft`);

  const submit = await fetch(`${product}/submissions`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ notes }),
  });
  if (submit.status !== 202) {
    throw new Error(
      `Edge publish: HTTP ${submit.status} ${JSON.stringify(await readBody(submit))}`,
    );
  }
  const submitId = operationId(submit, "Edge publish");
  await waitForOperation(
    `${product}/submissions/operations/${submitId}`,
    headers,
    "Edge publish",
    fetch,
    pollOptions,
  );
  console.log("Edge Add-ons: submitted for certification");
}
