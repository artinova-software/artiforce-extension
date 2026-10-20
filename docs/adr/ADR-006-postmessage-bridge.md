# ADR-006 — A postMessage bridge between the web app and the extension

## Status

Accepted.

## Date

2026-10-19

## Decision

A content script injected at `document_start` on the Artinova origins relays
the web app's `window.postMessage` requests to the service worker and posts
the answers back to `location.origin`. The protocol (v1) lives in
`libs/bridge`, which the web app copies. There is no `externally_connectable`.

## Rationale

- Works the same on Chrome, Edge and Firefox, without the extension ID being
  known to the web app.
- Mirrors Bitwarden's `content-message-handler`, a reviewed pattern.

## Consequences

- Any script running on an Artinova origin can talk to the bridge. The data is
  low-sensitivity (supplier products and prices the user chose), deletions are
  guarded by `revision` and `observedAt`, the bridge checks frame, origin,
  trust, schema and rate, and the web app treats every answer as untrusted.
- Origins outside the allow-list get no answer at all.
- Protocol changes follow [bridge-protocol.md](../bridge-protocol.md).
