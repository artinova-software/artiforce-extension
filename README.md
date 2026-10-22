# Artiforce browser extension

Add products from supplier websites (Leroy Merlin, Cedeo, Point.P, Rexel…) to a local
selection, then import that selection into an Artiforce quote or into the Library
with « Importer la sélection ».

- Manifest V3 for Chrome, Edge and Firefox.
- The extension never talks to the Artiforce API: the web app reads the selection
  through a `postMessage` bridge and writes with its own session.
- Rules and layout: [AGENTS.md](AGENTS.md). Architecture: [docs/architecture.md](docs/architecture.md).

## Requirements

- Node 24.20.0 (`.nvmrc`)
- pnpm 12.9.1 (`corepack enable` or the `packageManager` pin)

## Install and check

```bash
pnpm install
```

```bash
pnpm check
```

## Develop on Chrome

```bash
pnpm dev:chrome
```

This runs webpack in watch mode for the `development` target (bridge enabled on
`http://localhost:3000`, stable development extension ID) and prints the folder
to load:

1. Open `chrome://extensions` and enable **Developer mode**.
2. Click **Load unpacked** and pick `apps/browser/build/chrome-development`.
3. After each rebuild, click the reload icon on the extension card, then reload
   the supplier tab.

## Build

```bash
pnpm build:chrome
```

Outputs `apps/browser/build/<browser>-<target>/`. Targets: `development`,
`staging`, `production`, `e2e` (`build:edge`, `build:firefox` also exist).

## Tests

```bash
pnpm test
```

```bash
pnpm test:e2e
```

The end-to-end suite builds the `e2e` target and loads it in Chromium with
Playwright; supplier sites and the web app are simulated with `context.route`.

Manual checks against live sites (network, not run in CI) live in
`apps/browser/test/e2e/manual`: a real product image through the codec, the
whole chain on live supplier pages, and the production build loading cleanly.
Many suppliers block automated browsers (Leroy Merlin, Castorama, Cedeo…):
check those by hand with `pnpm dev:chrome`.

```bash
pnpm --filter @artiforce-software/browser-extension exec playwright test --config test/e2e/manual/playwright.manual.config.ts
```

## Package for the stores

```bash
pnpm dist
```

Produces `apps/browser/dist/artiforce-<browser>-production-<version>.zip` for
Chrome, Edge and Firefox plus a source archive for AMO. See
[docs/release.md](docs/release.md) and [docs/store-listing.md](docs/store-listing.md).

## License

AGPL-3.0-only, see [LICENSE](LICENSE).
