# Adding a supplier

Read [ADR-005](adr/ADR-005-static-host-list-from-registry.md) first: once the
extension is public, a new host is a new permission and disables the extension
for every user until they accept it. Before the first public release, add
hosts freely; after it, plan the change (optional permissions).

## 1. Scaffold

```bash
pnpm supplier:new point-p --name "Point.P" --host www.pointp.fr --segment pro --image-host media.pointp.fr --adapter
```

- Adds the record to `libs/suppliers/src/registry/suppliers.json`, sorted by id.
  `segment: "pro"` means prices are HT by default, `"retail"` TTC.
- With `--adapter`: `src/adapters/<id>.ts`, its test, and the registration in
  `src/adapters/index.ts`. Without it the supplier is `generic`: structured
  data only.
- Creates `libs/suppliers/fixtures/<id>/`.

Then fill in the record by hand:

- `imageHosts`: every CDN host the product images come from (check the image
  URL in the JSON-LD or `og:image`). An undeclared host makes the download fail.
- `productPath`: a regular expression the product page paths match, when the
  site has non-product pages carrying Product structured data.
- `checkedAt` and `notes`: when and what you checked.

## 2. Capture a fixture

Open a real product page in a browser, then either:

- **Save the page** (« Enregistrer sous », HTML only) and trim it:

  ```bash
  pnpm fixture:trim ~/Downloads/page.html --supplier point-p --case disjoncteur --url "https://www.pointp.fr/p/…"
  ```

- **Sites with bot protection** (DataDome, Cloudflare): open the devtools
  console on the page, paste the content of `scripts/lib/trim-core.mjs`
  without the `export` keywords, then run:

  ```js
  copy(trimDocument(document, { sourceUrl: location.href.split("#")[0], keep: [] }));
  ```

  Paste the clipboard into a file and run `pnpm fixture:trim` on it once more
  (it keeps the trimmed body as is).

Pass `--keep "<selector>"` (repeatable) to choose the product block and the
anchor yourself; by default the trimmer keeps the smallest block holding the
`h1` and the « Ajouter au panier » button. The fixture keeps meta tags,
JSON-LD without reviews, and texts cut to 160 characters: never store supplier
copy in bulk.

## 3. Write the adapter (verified suppliers)

An adapter is pure functions over the page (`libs/suppliers/src/adapters/adapter.ts`):

- `isProductPage(page)`: URL pattern plus a product-only element.
- `findAnchor(page)`: where the button goes (`afterend` the add-to-cart block).
- `refine(page, generic)`: what the generic chain gets wrong: the displayed
  price (promo), the supplier reference, the unit (« / m² »), the
  eco-contribution. Defined fields win.
- `detectPriceBasis(page)`: `HT`/`TTC` when the site says so unambiguously.

Bump `version` whenever the output changes.

## 4. Snapshot and check

```bash
pnpm vitest run --project suppliers -u
```

Review `src/adapters/__expected__/<id>/<case>.json` line by line against the
page: designation, reference, price in cents, basis, image URL. Then:

```bash
pnpm check
```

The registry tests check ids and hosts are unique, sorted, bare https hosts,
and that fixture images come from declared hosts; `manifest.test.mjs` shows
the permission change in its snapshot.

## 5. Try it

```bash
pnpm dev:chrome
```

Reload the extension, open a product page, click « Ajouter à Artinova », and
check the popup.
