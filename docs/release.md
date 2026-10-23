# Release

## Version

The root `package.json` `version` is the only source: the build writes it into
every manifest, and the Safari job writes it into the app as
`CFBundleShortVersionString` (its `CFBundleVersion` is the UTC upload time,
`YYYYMMDDHHMM`). Stores refuse a version they already have, so every upload is
a new version.

## Cut a release

1. Make sure `main` is green (CI `verify` and `e2e`).
2. Run the **Release** workflow (`.github/workflows/release.yml`) from `main`,
   choosing `patch`, `minor` or `major` and the French « Nouveautés » text
   (AMO release notes and the App Store « What's New »). It:
   - runs `pnpm check`;
   - bumps the version, commits `chore(release): vX.Y.Z` and tags `vX.Y.Z`;
   - runs `pnpm dist`: production builds for Chrome, Edge, Firefox and Safari,
     `web-ext lint` on the Firefox build, the four zips and the source archive;
   - pushes the commit and the tag, and publishes a GitHub release with the
     zips and generated notes;
   - calls **Publish to the stores** (`publish.yml`) for the stores listed in
     the `PUBLISH_STORES` repository variable (default `chrome,firefox,safari`;
     add `edge` once its credentials exist).
3. Approve the `production` deployment in the run (one approval releases every
   store job). Each job uploads its package and submits it for review:

   | Job                    | Store                  | Goes live                              |
   | ---------------------- | ---------------------- | -------------------------------------- |
   | Chrome Web Store       | Chrome Web Store       | automatically once Google approves it  |
   | Edge Add-ons           | Microsoft Edge Add-ons | automatically after certification      |
   | Firefox (AMO)          | addons.mozilla.org     | automatically once a reviewer signs it |
   | Safari (Mac App Store) | Mac App Store          | automatically once Apple approves it   |

A store job that failed is retried with **Publish to the stores → Run
workflow**, the same tag and only that store (`stores: safari` for instance).
It re-sends the release assets; nothing is rebuilt.

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
| `artiforce-safari-production-<version>.zip`  | the Xcode project in `apps/safari`           |
| `artiforce-source-<version>.zip`             | AMO source review (`git archive` of the tag) |

## One-time setup

The API of every store only updates an item that already exists: the first
version of each listing is submitted by hand, with the zips of a release and
the texts of [store-listing.md](store-listing.md). After that, the pipeline
does every update.

### GitHub

- Environment `production` (Settings → Environments) with a required reviewer,
  restricted to the `main` branch and `v*` tags. Its secrets and variables are
  the store credentials below.
- Repository variable `PUBLISH_STORES`: `chrome,firefox,safari` (add `edge`
  when ready).

### Store credentials

| Store   | Kind     | Name                            | Where it comes from                                                                                                                                                                                              |
| ------- | -------- | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Chrome  | variable | `CWS_PUBLISHER_ID`              | Developer Dashboard → Publisher → Settings.                                                                                                                                                                      |
| Chrome  | variable | `CWS_ITEM_ID`                   | The 32-letter ID of the published item.                                                                                                                                                                          |
| Chrome  | secret   | `CWS_SERVICE_ACCOUNT_KEY`       | Google Cloud project with the Chrome Web Store API enabled, a service account without roles, its JSON key; the service account email added in Developer Dashboard → Account (one service account per publisher). |
| Firefox | secret   | `AMO_JWT_ISSUER`                | addons.mozilla.org → Developer Hub → Tools → Manage API Keys (JWT issuer).                                                                                                                                       |
| Firefox | secret   | `AMO_JWT_SECRET`                | Same page (JWT secret).                                                                                                                                                                                          |
| Safari  | variable | `APPLE_TEAM_ID`                 | developer.apple.com → Membership (10 characters).                                                                                                                                                                |
| Safari  | secret   | `APP_STORE_CONNECT_KEY_ID`      | App Store Connect → Users and Access → Integrations → Team Keys, a key with the **Admin** role (cloud-managed signing creates the distribution certificates).                                                    |
| Safari  | secret   | `APP_STORE_CONNECT_ISSUER_ID`   | Same page, above the keys.                                                                                                                                                                                       |
| Safari  | secret   | `APP_STORE_CONNECT_PRIVATE_KEY` | The `.p8` file of that key, whole (downloadable once).                                                                                                                                                           |
| Edge    | variable | `EDGE_PRODUCT_ID`               | Partner Center → Microsoft Edge → the extension → Product ID.                                                                                                                                                    |
| Edge    | secret   | `EDGE_CLIENT_ID`                | Partner Center → Microsoft Edge → Publish API (new experience, v1.1).                                                                                                                                            |
| Edge    | secret   | `EDGE_API_KEY`                  | Same page. API keys expire: renew it before the date shown there.                                                                                                                                                |

### Safari

The Xcode project `apps/safari/Artiforce` was generated by
`xcrun safari-web-extension-converter` and references the Safari build in
`apps/browser/build/safari-production` (relative paths: nothing is copied).
App `fr.artiforce.Artiforce`, extension `fr.artiforce.Artiforce.Extension`,
macOS 13 and Safari 17 minimum, category Productivity, no non-exempt
encryption.

1. Register both bundle identifiers (Certificates, Identifiers & Profiles), or
   let the first archive with `-allowProvisioningUpdates` register them.
2. Create the macOS app in App Store Connect with the bundle identifier
   `fr.artiforce.Artiforce`, primary language French, and fill the listing:
   description, 1280 × 800 screenshots, support and privacy policy URLs,
   privacy « Données non collectées », free price.
3. Replace the app icons in `Artiforce/Assets.xcassets/AppIcon.appiconset`
   with real 16 to 1024 px artwork: the converter upscaled the 128 px icon.
4. First version: set the repository variable `SAFARI_SUBMIT_FOR_REVIEW` to
   `false`, run the release (the build is uploaded, not submitted), pick the
   build in App Store Connect and submit it by hand. Then delete the variable.

Locally, after `pnpm build:safari`, open the project in Xcode and run the
`Artiforce` scheme; enable the extension in Safari → Settings → Extensions
(Develop → Allow Unsigned Extensions for an unsigned build). Safari asks each
user to allow the extension on the supplier sites.

### Firefox (AMO)

The first listed version is submitted by hand with the source archive and the
build steps below. Every later version is sent by `web-ext sign
--channel=listed` with the same steps as reviewer notes
(`apps/browser/scripts/stores/amo.mjs`):

```text
Node 24.20.0 and pnpm 12.9.1 (corepack enable).
pnpm install --frozen-lockfile
pnpm build:firefox
Output: apps/browser/build/firefox-production (identical to the uploaded zip).
Content scripts are not minified; the popup and background bundles are
minified by terser from the TypeScript sources in apps/browser/src and libs/.
```

### Chrome Web Store

Host permission changes trigger an in-depth review. If the visibility was
changed in the dashboard, publish once by hand before the API can publish
again.

## Host permissions after the first public release

Adding a supplier host is a new permission and disables the extension for
existing users until they accept it ([ADR-005](adr/ADR-005-static-host-list-from-registry.md)).
Re-enabling a `disabled` supplier is free (its hosts never left the manifest).
New suppliers after the first public release go through
`optional_host_permissions` and `scripting.registerContentScripts`.

## Rollback

Stores do not roll back: publish a new patch version built from the last good
tag (cherry-pick the revert on `main`, run the Release workflow).
