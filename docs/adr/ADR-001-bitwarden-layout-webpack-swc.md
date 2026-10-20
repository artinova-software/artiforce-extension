# ADR-001 — Follow Bitwarden's browser extension layout, built with webpack and swc

## Status

Accepted.

## Date

2026-10-19

## Decision

The extension copies the structure of `bitwarden/clients/apps/browser`: feature
folders split by execution context (`background/`, `content/`, `popup/`,
`services/`, `models/`), a `platform/` layer (static `BrowserApi`, typed
messaging authorized by the sender, a light StateProvider), manual dependency
injection in `MainBackground`, one manifest template with `__chrome__` /
`__firefox__` / `__edge__` keys flattened at build time, and two webpack
configurations (`main` for the popup and content scripts, `background` for the
service worker). TypeScript is transpiled by `swc-loader`; `tsc --noEmit` (v7)
only type-checks.

## Rationale

Bitwarden's extension is a long-lived, multi-browser MV3 code base whose
choices answer the problems we have: classic-script content scripts, a service
worker that can stop at any time, per-browser manifests, store reviews. Copying
a proven layout is cheaper than inventing one. TypeScript 7 has no JavaScript
API, so loaders that call it (`ts-loader`) are out; swc is fast and already
used in the Artinova monorepo.

## Consequences

- Each content script is a self-contained IIFE (`splitChunks: false`); a
  `ForbiddenModulesPlugin` fails the build on React in the background or a
  content script, and on async chunks outside the popup.
- The background is also type-checked against the `WebWorker` lib
  (`tsconfig.background.json`), so `window` cannot creep in.
- Adaptations to our size: one pnpm workspace without Nx, no RxJS, no Angular,
  no Lit (`customElements` is null in content scripts), Vitest instead of Jest,
  MV3 only, no Safari.
