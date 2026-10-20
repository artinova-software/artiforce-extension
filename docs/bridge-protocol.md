# Bridge protocol (v1)

How the Artinova web app reads the extension's selection. The extension never
calls the Artinova API ([ADR-002](adr/ADR-002-no-api-calls-web-app-imports.md)):
the web app asks the extension for the selection over `window.postMessage`, shows
a controlled preview, then writes with its own session.

Source of truth: [`libs/bridge/src`](../libs/bridge/src). The web app **copies**
that folder into its code (no npm package) with a header naming the commit:

```ts
// Copied from artinova-software/artinova-extension@<sha> libs/bridge/src. Do not edit here.
```

## Transport

```
web app page ──postMessage(request, location.origin)──▶ bridge content script
                                                        (document_start, top frame,
                                                         Artinova origins only)
bridge content script ──runtime.sendMessage──▶ service worker (sender must be
                                               a bridge content script)
web app page ◀──postMessage(response | event, location.origin)── bridge content script
```

- The content script is declared in the manifest on `artinovaOrigins`
  (`https://app.artinova.fr`, `https://staging.artinova.fr`,
  `http://localhost:3000` depending on the build target). There is no
  `externally_connectable`.
- Messages are only ever posted to `location.origin`, never `"*"`.
- An origin outside the allow-list gets **no answer at all**: the client times
  out (`TIMEOUT`) exactly as if no extension were installed.

## Envelope

Every message carries `channel: "artinova-bridge"` and `protocol: 1`.

```ts
// web app → extension
{ channel, direction: "request", protocol: 1, id: string /* [A-Za-z0-9_-]{1,64} */, command, params }
// extension → web app
{ channel, direction: "response", protocol: 1, id, ok: true, result }
{ channel, direction: "response", protocol: 1, id, ok: false, error: { code, message } }
// extension → web app, unsolicited
{ channel, direction: "event", protocol: 1, event, data }
```

Requests are strict objects: an unknown key is `INVALID_REQUEST`.

## Commands

| Command       | Params                                       | Result                                                                                                        |
| ------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `hello`       | `{}`                                         | `{ extensionVersion, browser: "chrome" \| "edge" \| "firefox", protocols: number[], capabilities: string[] }` |
| `getCart`     | `{}`                                         | `{ revision, items: BridgeCartItem[] }` (100 items max)                                                       |
| `getImages`   | `{ itemIds: uuid[] }` (1 to 10)              | `{ images: { itemId, dataUrl \| null, width \| null, height \| null }[] }`, JPEG ≤ 1024 px                    |
| `removeItems` | `{ items: { id, observedAt }[] }` (1 to 100) | `{ removed: uuid[], kept: uuid[], revision }`                                                                 |
| `clearCart`   | `{ expectedRevision }`                       | `{ revision }`                                                                                                |

- `removeItems` removes an item only if its `observedAt` still equals the one
  sent: a product re-captured meanwhile (new price) stays in the selection and
  is listed in `kept`. Call it after a successful import.
- `clearCart` fails with `REVISION_MISMATCH` when the selection changed since
  the `revision` the web app read.

### `BridgeCartItem`

```ts
{
  id: uuid, observedAt: ISO date, expiresAt: ISO date,
  supplier: { id, name },
  designation, supplierCode, manufacturerCode, gtin, brand,
  unit: "u" | "m" | "ml" | "m²" | "m³" | "kg" | "l" | null,
  packagingQuantity: number | null,
  productUrl: https URL,
  price: { cents: int | null, currency: "EUR", basis: "HT" | "TTC" | "UNKNOWN",
           basisSource: "adapter" | "page-text" | "structured-data" | "registry-default" | "none" },
  ecoContributionCents: int | null,
  image: { status: "none" | "pending" | "ready" | "failed", width, height },
}
```

The price is the one displayed on the supplier page, with the basis the
extension detected ([ADR-004](adr/ADR-004-observed-price-and-basis.md)). The
web app applies Artinova's margin rules, asks to confirm `UNKNOWN` bases, and
shows « Prix relevé le … ». There is no quantity: the preview sets it.

## Events

| Event          | Data                              | When                                                                               |
| -------------- | --------------------------------- | ---------------------------------------------------------------------------------- |
| `ready`        | `{ extensionVersion, protocols }` | Once the bridge listens (the page may already be running: call `hello` too).       |
| `cart.changed` | `{ revision, count }`             | After every change. Counts only: enough to show or hide « Importer la sélection ». |

## Errors

| Code                    | Meaning                                                                           |
| ----------------------- | --------------------------------------------------------------------------------- |
| `INVALID_REQUEST`       | Envelope or params fail the schema.                                               |
| `UNSUPPORTED_PROTOCOL`  | `protocol` is not one the extension speaks.                                       |
| `UNKNOWN_COMMAND`       | Not in the command list.                                                          |
| `FORBIDDEN`             | The background refused the sender (should not happen from a genuine page).        |
| `REVISION_MISMATCH`     | `clearCart` on a stale revision.                                                  |
| `EXTENSION_RELOADED`    | The extension was updated under the page: reload the page.                        |
| `INTERNAL`              | Anything else.                                                                    |
| `TIMEOUT` (client only) | No answer: no extension, origin not allowed, or more than 20 requests per second. |

## Checks on the extension side

In the content script (`apps/browser/src/bridge/content/message-guard.ts`):
top frame only; `event.isTrusted`; `event.source === window`;
`event.origin === location.origin` and that origin in the allow-list; channel
and direction; strict schema; command allow-list, with the params rebuilt from
the command schema before relaying; 20 requests per second at most.

In the service worker: the sender must classify as a bridge content script
(browser-provided `sender.url`, top frame), the request is revalidated with the
same `libs/bridge` schemas, and `CartItem` is mapped to `BridgeCartItem` in
`to-wire.ts` (internal fields never leave).

## Versioning

- Optional additions (a new optional field, a new command, a new event) stay
  in v1: the web app ignores what it does not know and checks `capabilities`.
- A breaking change is v2. During one release the extension answers both v1
  and v2 (`SUPPORTED_PROTOCOLS`), and `hello` lists both.
- Any change to `libs/bridge` updates this file, and the web app recopies the
  folder with the new commit in its header.

## Web app usage

```ts
import { BridgeClient } from "./vendor/extension-bridge";

const bridge = new BridgeClient(window, { timeoutMs: 2000 });
const hello = await bridge.detect(); // null: no extension, hide the button
bridge.on("cart.changed", ({ count }) => setImportVisible(count > 0));
const { revision, items } = await bridge.request("getCart", {});
const { images } = await bridge.request("getImages", {
  itemIds: items.slice(0, 10).map((i) => i.id),
});
// …preview, confirm, write with the Artinova SDK…
await bridge.request("removeItems", {
  items: imported.map(({ id, observedAt }) => ({ id, observedAt })),
});
```
