import { createVerify, generateKeyPairSync } from "node:crypto";

import { describe, expect, it } from "vitest";

import { amoMetadata } from "./amo.mjs";
import { publishToChromeWebStore } from "./chrome-web-store.mjs";
import { publishToEdgeAddOns } from "./edge-add-ons.mjs";
import { poll } from "./poll.mjs";

const fast = { intervalMs: 1, timeoutMs: 1000 };

/** A fetch that answers each call from the next route matching its URL. */
function fakeFetch(routes) {
  const calls = [];
  const fetch = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    const index = routes.findIndex((route) => String(url).includes(route.match));
    if (index === -1) {
      throw new Error(`Unexpected request ${url}`);
    }
    const [route] = routes.splice(index, 1);
    return new Response(route.body === undefined ? null : JSON.stringify(route.body), {
      status: route.status ?? 200,
      headers: route.headers,
    });
  };
  return { fetch, calls };
}

describe("publishToChromeWebStore", () => {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const serviceAccountKey = {
    client_email: "publisher@artiforce.iam.gserviceaccount.com",
    private_key: privateKey.export({ type: "pkcs8", format: "pem" }),
  };
  const item = "publishers/pub-1/items/item-1";

  it("signs the token request, waits for the upload, then publishes", async () => {
    const { fetch, calls } = fakeFetch([
      { match: "oauth2.googleapis.com/token", body: { access_token: "token-1" } },
      { match: `/upload/v2/${item}:upload`, body: { uploadState: "IN_PROGRESS" } },
      { match: ":fetchStatus", body: { lastAsyncUploadState: "IN_PROGRESS" } },
      { match: ":fetchStatus", body: { lastAsyncUploadState: "SUCCEEDED", crxVersion: "1.2.3" } },
      { match: `/v2/${item}:publish`, body: { state: "PENDING_REVIEW" } },
    ]);

    const state = await publishToChromeWebStore({
      zip: Buffer.from("zip"),
      version: "1.2.3",
      publisherId: "pub-1",
      itemId: "item-1",
      serviceAccountKey,
      fetch,
      pollOptions: fast,
    });

    expect(state).toBe("PENDING_REVIEW");
    const assertion = new URLSearchParams(calls[0].init.body).get("assertion");
    const [header, claims, signature] = assertion.split(".");
    expect(JSON.parse(Buffer.from(claims, "base64url"))).toMatchObject({
      iss: serviceAccountKey.client_email,
      scope: "https://www.googleapis.com/auth/chromewebstore",
    });
    const verify = createVerify("RSA-SHA256").update(`${header}.${claims}`);
    expect(verify.verify(publicKey, signature, "base64url")).toBe(true);
    expect(calls[1].init.headers.Authorization).toBe("Bearer token-1");
    expect(JSON.parse(calls[4].init.body)).toEqual({ publishType: "DEFAULT_PUBLISH" });
  });

  it("refuses a package whose version is not the release version", async () => {
    const { fetch } = fakeFetch([
      { match: "token", body: { access_token: "token-1" } },
      { match: ":upload", body: { uploadState: "SUCCEEDED", crxVersion: "1.2.2" } },
    ]);
    await expect(
      publishToChromeWebStore({
        zip: Buffer.from("zip"),
        version: "1.2.3",
        publisherId: "pub-1",
        itemId: "item-1",
        serviceAccountKey,
        fetch,
      }),
    ).rejects.toThrow("received version 1.2.2, expected 1.2.3");
  });

  it("stops on a failed upload without publishing", async () => {
    const { fetch, calls } = fakeFetch([
      { match: "token", body: { access_token: "token-1" } },
      { match: ":upload", body: { uploadState: "FAILED" } },
    ]);
    await expect(
      publishToChromeWebStore({
        zip: Buffer.from("zip"),
        version: "1.2.3",
        publisherId: "pub-1",
        itemId: "item-1",
        serviceAccountKey,
        fetch,
      }),
    ).rejects.toThrow("ended in FAILED");
    expect(calls.some((call) => call.url.includes(":publish"))).toBe(false);
  });
});

describe("publishToEdgeAddOns", () => {
  const options = {
    zip: Buffer.from("zip"),
    version: "1.2.3",
    productId: "product-1",
    clientId: "client-1",
    apiKey: "key-1",
    notes: "notes",
    pollOptions: fast,
  };

  it("follows the upload and publish operations from their Location headers", async () => {
    const { fetch, calls } = fakeFetch([
      { match: "/draft/package/operations/op-up", body: { status: "InProgress" } },
      { match: "/draft/package/operations/op-up", body: { status: "Succeeded" } },
      { match: "/draft/package", status: 202, headers: { Location: "op-up" } },
      { match: "/submissions/operations/op-pub", body: { status: "Succeeded" } },
      {
        match: "/products/product-1/submissions",
        status: 202,
        headers: { Location: "/v1/products/product-1/submissions/operations/op-pub" },
      },
    ]);

    await publishToEdgeAddOns({ ...options, fetch });

    expect(calls.map((call) => call.url.split("/v1")[1])).toEqual([
      "/products/product-1/submissions/draft/package",
      "/products/product-1/submissions/draft/package/operations/op-up",
      "/products/product-1/submissions/draft/package/operations/op-up",
      "/products/product-1/submissions",
      "/products/product-1/submissions/operations/op-pub",
    ]);
    expect(calls[0].init.headers).toMatchObject({
      Authorization: "ApiKey key-1",
      "X-ClientID": "client-1",
    });
    expect(JSON.parse(calls[3].init.body)).toEqual({ notes: "notes" });
  });

  it("stops when the upload operation fails", async () => {
    const { fetch } = fakeFetch([
      {
        match: "/operations/op-up",
        body: { status: "Failed", errors: [{ message: "Bad manifest" }] },
      },
      { match: "/draft/package", status: 202, headers: { Location: "op-up" } },
    ]);
    await expect(publishToEdgeAddOns({ ...options, fetch })).rejects.toThrow("Bad manifest");
  });
});

describe("amoMetadata", () => {
  it("carries the French release notes and the reviewer's build steps", () => {
    const metadata = amoMetadata({ releaseNotes: "Nouveaux fournisseurs." });
    expect(metadata.version.release_notes).toEqual({ fr: "Nouveaux fournisseurs." });
    expect(metadata.version.approval_notes).toContain("pnpm build:firefox");
  });
});

describe("poll", () => {
  it("gives up after the timeout", async () => {
    await expect(
      poll(async () => ({ done: false }), { label: "Store", intervalMs: 5, timeoutMs: 12 }),
    ).rejects.toThrow("Store: still in progress");
  });
});
