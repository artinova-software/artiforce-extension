# Release

## Version

The root `package.json` `version` is the only source: the build writes it into
every manifest. Stores refuse a version they already have, so every upload is
a new version.

## Cut a release

1. Make sure `main` is green (CI `verify` and `e2e`).
2. Run the **Release** workflow (`.github/workflows/release.yml`) from `main`,
   choosing `patch`, `minor` or `major`. It:
   - runs `pnpm check`;
   - bumps the version, commits `chore(release): vX.Y.Z` and tags `vX.Y.Z`;
   - runs `pnpm dist`: production builds for Chrome, Edge and Firefox,
     `web-ext lint` on the Firefox build, the three zips and the source archive;
   - pushes the commit and the tag, and publishes a GitHub release with the
     zips and generated notes.

A dry run locally:

```bash
pnpm dist
```

Outputs in `apps/browser/dist/`:

| File                                         | For                                          |
| -------------------------------------------- | -------------------------------------------- |
| `artiforce-chrome-production-<version>.zip`  | Chrome Web Store                             |
| `artiforce-edge-production-<version>.zip`    | Microsoft Edge Add-ons                       |
| `artiforce-firefox-production-<version>.zip` | addons.mozilla.org (AMO)                     |
| `artiforce-source-<version>.zip`             | AMO source review (`git archive` of the tag) |

## Upload to the stores (manual)

Texts, permission justifications and privacy answers:
[store-listing.md](store-listing.md).

- **Chrome Web Store** (developer dashboard, Artiforce publisher account):
  upload the Chrome zip, check the listing, submit. Host permission changes
  trigger an in-depth review: say so in the notes to the reviewer.
- **Edge Add-ons** (Partner Center): upload the Edge zip, same listing.
- **Firefox (AMO)**: upload the Firefox zip, then the source archive with
  these build steps for the reviewer:

  ```text
  Node 24.20.0 and pnpm 12.9.1 (corepack enable).
  pnpm install --frozen-lockfile
  pnpm build:firefox
  Output: apps/browser/build/firefox-production (identical to the uploaded zip).
  Content scripts are not minified; the popup and background bundles are
  minified by terser from the TypeScript sources in apps/browser/src and libs/.
  ```

## Host permissions after the first public release

Adding a supplier host is a new permission and disables the extension for
existing users until they accept it ([ADR-005](adr/ADR-005-static-host-list-from-registry.md)).
Re-enabling a `disabled` supplier is free (its hosts never left the manifest).
New suppliers after the first public release go through
`optional_host_permissions` and `scripting.registerContentScripts`.

## Rollback

Stores do not roll back: publish a new patch version built from the last good
tag (cherry-pick the revert on `main`, run the Release workflow).
