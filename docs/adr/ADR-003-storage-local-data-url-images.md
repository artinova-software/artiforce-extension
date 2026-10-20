# ADR-003 — Selection in storage.local, images downloaded by the service worker as data URLs

## Status

Accepted.

## Date

2026-10-19

## Decision

The selection lives in `chrome.storage.local` (`global_cart_state`), validated
by Zod on every read, written only by the background under a mutex. Product
images are downloaded by the service worker (host permission, `credentials:
"omit"`, 10 s timeout, raster types only, 15 MB cap, magic-byte check), drawn
on an `OffscreenCanvas` over white, re-encoded as JPEG 0.85 at 1024 px max plus
a 128 px thumbnail, and stored as data URLs under `global_image_<item id>`.
The web app receives them with `getImages`.

## Rationale

- The Artinova API refuses external image URLs and the web app's CSP blocks
  supplier CDNs, but already allows `img-src data: blob:`.
- Downloading in the service worker uses the extension's host permissions, so
  supplier CORS rules do not apply; omitting credentials keeps the user's
  supplier session out of it.
- `storage.local` survives browser restarts (the selection is kept 7 days);
  `unlimitedStorage` covers 100 items with images (about 10 MB at most).

## Consequences

- A CDN that requires a `Referer` makes the download fail: the item is marked
  `failed` and imports without a photo. A fallback through the content script
  can come later.
- SVG images are never accepted.
- Removing, clearing, purging or importing an item deletes its image.
