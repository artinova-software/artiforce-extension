# ADR-004 — Report the observed price and its basis; margins stay in Artinova

## Status

Accepted.

## Date

2026-10-19

## Decision

For each product the extension reports the price displayed on the supplier
page, in integer cents, with the basis it detected: `HT`, `TTC` or `UNKNOWN`,
and where that basis came from (`adapter`, `page-text`, `structured-data`,
`registry-default`, `none`). It applies no margin, converts nothing and has no
options page. Artinova's margin rules apply in the web app and the server.

## Rationale

- Margins, VAT rates and rounding are Artinova's business rules; duplicating
  them in an extension would drift.
- A wrong basis is the costliest error (a 20 % gap), so doubt is explicit:
  `UNKNOWN` makes the web app ask the user to confirm.

## Consequences

- Priority: adapter, then text next to the price, then structured data
  (`valueAddedTaxIncluded`), then the registry default (`retail` sites are TTC,
  `pro` sites HT). A « À partir de » price is `UNKNOWN`.
- Promo or struck prices, eco-contributions, per-lot or per-unit prices and
  prices shown only to logged-in pros are handled per adapter; every item shows
  « Prix relevé le … ».
