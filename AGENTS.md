# AGENTS.md

Single entry point for anyone (human or agent) changing this repository. Read it
before editing; `CLAUDE.md` points here.

## What this is

The Artinova browser extension (Manifest V3; Chrome, Edge, Firefox). It injects an
« Ajouter à Artinova » button on supplier product pages, keeps the captured products
in a local selection (popup, badge, 7-day expiry, 100 items max), and exposes that
selection to the Artinova web app through a `postMessage` bridge so the web app can
offer « Importer la sélection ».

Architecture follows `bitwarden/clients/apps/browser`: feature folders split by
execution context, two webpack configs, one manifest template with per-browser keys,
a static `BrowserApi`, typed messaging authorized by the sender, a light
StateProvider, manual dependency injection in `MainBackground`, closed Shadow DOM.
See [docs/architecture.md](docs/architecture.md).

## Layout

| Path             | Package                                  | Role                                                                           |
| ---------------- | ---------------------------------------- | ------------------------------------------------------------------------------ |
| `libs/suppliers` | `@artinova-software/extension-suppliers` | Supplier registry, price parsing, product extraction, adapters. Pure TS + DOM. |
| `libs/bridge`    | `@artinova-software/extension-bridge`    | Bridge wire protocol (zod only). Copied into the web app.                      |
| `apps/browser`   | `@artinova-software/browser-extension`   | The extension: background, content scripts, popup.                             |

Inside `apps/browser/src`, each feature (`cart`, `capture`, `images`, `bridge`,
`suppliers`) holds `background/`, `content/`, `popup/`, `services/`, `models/` as
needed. `platform/` holds the cross-cutting runtime (BrowserApi, messaging, state,
logging, i18n, config, concurrency).

## Hard rules

1. **The extension never calls the Artinova API.** No auth, no tokens, no fetch to
   `*.artinova.fr`. The web app reads the selection through the bridge and writes
   with its own session ([ADR-002](docs/adr/ADR-002-no-api-calls-web-app-imports.md)).
2. **Zod at every boundary**: messages, bridge payloads, storage reads, config,
   extracted products. A storage value that fails its schema falls back to the
   default and logs a warning.
3. **No `chrome.*` / `browser.*` outside `platform/browser/`** (content scripts may
   check `chrome.runtime?.id` through `BrowserApi.contextValid()` too). ESLint
   enforces it.
4. **Layer boundaries** (ESLint): background, platform and services import neither
   React, Phosphor, popup nor content code; content scripts import neither React nor
   popup/background/services; the popup imports neither content, background nor
   services. Libraries never import `apps/*`; `libs/bridge` imports only `zod`.
5. **Authorization comes from the browser-provided sender**, never from message
   content: every command declares the sender kinds allowed to call it.
6. **Only the background writes state**, under a mutex. The popup and content
   scripts read or send commands.
7. **Listeners are registered synchronously** at the top level of the service
   worker (MV3). Use alarms, never long timers. Storage is the source of truth.
8. **Content scripts are classic scripts**: one self-contained IIFE per entry, no
   dynamic `import()`. `ForbiddenModulesPlugin` fails the build otherwise.
9. **Money is integer cents.** The extension reports the observed price and its
   basis (`HT`, `TTC`, `UNKNOWN`); margins are Artinova's job
   ([ADR-004](docs/adr/ADR-004-observed-price-and-basis.md)).
10. **Images travel as data URLs** downloaded by the service worker, only from hosts
    declared for the supplier ([ADR-003](docs/adr/ADR-003-storage-local-data-url-images.md)).
11. **Bridge versioning**: optional additions stay in protocol v1; a breaking change
    is v2 and the extension answers both for one release
    ([docs/bridge-protocol.md](docs/bridge-protocol.md)).
12. **Host list comes from `libs/suppliers/src/registry/suppliers.json`** and is
    generated into the manifest. Adding a host after the first public release
    disables the extension for users until they accept it: see
    [ADR-005](docs/adr/ADR-005-static-host-list-from-registry.md).

## Conventions

- Node 24.20.0, pnpm 12.9.1, TypeScript 7 (`tsc --noEmit`; swc transpiles; ESLint
  runs on the TypeScript 6 alias), Vitest 5, Playwright 1.64, Prettier width 100.
- No `enum`: `const` objects plus union types. Kebab-case file names. `curly` always.
  No `console` outside `console-log.service.ts`.
- Icons: `@phosphor-icons/react` only (lucide is banned).
- Visible text in French: vouvoiement, « », …, never an em dash, « Non renseigné »
  for an empty value. Code, comments and commits in English
  (`type(scope): summary`).
- Tests sit next to the code (`*.test.ts`); the fake `chrome` lives in
  `apps/browser/test/chrome-fake.ts`.

## Commands

```bash
pnpm install
pnpm check            # format, lint, typecheck (DOM + WebWorker), unit tests
pnpm dev:chrome       # watch build + instructions to load it
pnpm build:chrome     # also build:edge, build:firefox
pnpm test:e2e         # Playwright, loads build/chrome-e2e
pnpm dist             # three store zips + source archive
pnpm supplier:new     # scaffold a supplier (docs/adding-a-supplier.md)
pnpm fixture:trim     # trim a captured product page into a fixture
```
