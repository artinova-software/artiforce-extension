# ADR-002 — The extension never calls the Artinova API; the web app imports

## Status

Accepted.

## Date

2026-10-19

## Decision

The extension holds no Artinova credentials and sends no request to the
Artinova API. It keeps the captured products locally. The Artinova web app
reads them through the `postMessage` bridge ([ADR-006](ADR-006-postmessage-bridge.md)),
shows a controlled preview (duplicates, HT/TTC, `margin:view` /
`margin:manage` rights) and writes with its own session and SDK
(`addQuoteLine`, `replaceQuoteLines`, `createCatalogItem`,
`uploadCatalogItemFile`).

## Rationale

- No second authentication surface (Clerk tokens in an extension, refresh,
  revocation) and no CORS rule for an extension origin.
- The web app already owns tenancy, permissions, margin rules and validation;
  the import goes through the same code paths as every other write.
- The user sees and confirms what is imported, as in the InterFast model, with
  a preview instead of a blind push.

## Consequences

- « Importer la sélection » only works with the web app open, in the same
  browser profile as the extension.
- Images must reach the web app as bytes ([ADR-003](ADR-003-storage-local-data-url-images.md)).
- Any data the extension returns is untrusted input for the web app.
