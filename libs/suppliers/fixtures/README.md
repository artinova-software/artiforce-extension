# Supplier fixtures

Real product pages, captured from a browser and reduced by `pnpm fixture:trim`
(`scripts/trim-fixture.mjs`): only the meta tags, the JSON-LD (reviews dropped,
long strings cut), the product block and the button anchor are kept, each with a
bare skeleton of its ancestors so the adapter selectors still match. Long texts
are cut to 160 characters: no supplier copy is stored in bulk.

Each file starts with a provenance comment (`source`, `captured`), which the
tests read to rebuild the page URL. The expected extraction is snapshotted in
`libs/suppliers/src/adapters/__expected__/<supplier-id>/<case>.json`; update it
with `pnpm vitest run --project suppliers -u` and review the diff.

Captures were reduced further by hand when the trimmer kept page chrome
(navigation, recommendations): only what the adapter reads stays.

Sites behind bot protection (DataDome, Cloudflare) cannot be fetched by a
script: open the page in a browser, then run `trimDocument` from
`scripts/lib/trim-core.mjs` in the devtools console (see
[docs/adding-a-supplier.md](../../../docs/adding-a-supplier.md)), save the output
and pass it through `pnpm fixture:trim` once more.

| Supplier     | Case                         | Source                                                                                                                                                                                                                                                              | Captured   |
| ------------ | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| amazon       | disjoncteur-legrand          | https://www.amazon.fr/dp/B007AKRNYE                                                                                                                                                                                                                                 | 2026-10-19 |
| brico-depot  | plaque-ba13-m2               | https://www.bricodepot.fr/p/3334160295318/plaque-ba13-nf-standard-2-5-x-1-2m                                                                                                                                                                                        | 2026-10-19 |
| castorama    | ciment-25kg                  | https://www.castorama.fr/ciment-allcem-cem-ii-b-m-32-5r-25-kg/3596700102689_CAFR.prd                                                                                                                                                                                | 2026-10-19 |
| cedeo        | filtre-magnetique-public-ttc | https://www.cedeo.fr/p/droguerie-et-fixations/filtre-magnetique-magmax-solutech-1%22-special-pac-chaudieres-debit-6-m%C2%B3-h-ref-125688578-A4988574                                                                                                                | 2026-10-19 |
| ikea         | kallax-promo                 | https://www.ikea.com/fr/fr/p/kallax-etagere-blanc-80275887/                                                                                                                                                                                                         | 2026-10-19 |
| legallais    | mousse-coupe-feu             | https://www.legallais.com/produit/mousses-polyurethane-coupe-feu-2-en-1/26345/498618                                                                                                                                                                                | 2026-10-19 |
| leroy-merlin | sac-gravats-lot              | https://www.leroymerlin.fr/produits/sac-a-gravats-ocai-70-l-66471860.html                                                                                                                                                                                           | 2026-10-19 |
| point-p      | bloc-beton-par-cent          | https://www.pointp.fr/p/gros-oeuvre-bpe-voirie-tp/bloc-beton-creux-classe-b40-500x200x200-mm-A6271676                                                                                                                                                               | 2026-10-19 |
| rexel        | disjoncteur-sans-connexion   | https://www.rexel.fr/frx/Cat%C3%A9gorie/Distribution-et-gestion-de-l%27%C3%A9nergie/Distribution-et-protection-AC/Disjoncteur-modulaire-pour-logement/Disjoncteur-DNX%C2%B3-4500---auto-auto---1P%2BN-230V-16A---4%2C5kA---courbe-C---1-module/LEG406783/p/69705080 | 2026-10-19 |
