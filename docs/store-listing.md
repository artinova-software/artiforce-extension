# Store listing

Texts to paste in the Chrome Web Store, Edge Add-ons and AMO dashboards. User
facing texts are French; reviewer notes are English.

## Listing (French)

- **Nom** : Artinova, produits fournisseurs
- **Description courte** (132 caractères max) : Ajoutez des produits depuis les
  sites de vos fournisseurs et importez-les dans vos devis Artinova.
- **Catégorie** : Productivité (outils de travail).
- **Langue** : français.

**Description détaillée**

> Constituez votre sélection de produits directement sur les sites de vos
> fournisseurs, puis importez-la dans Artinova en un clic.
>
> Comment ça marche :
>
> 1. Sur la fiche d'un produit (Leroy Merlin, Cedeo, Point.P, Rexel,
>    Castorama, Brico Dépôt, IKEA, Legallais et plus de 130 autres sites),
>    cliquez sur « Ajouter à Artinova ».
> 2. Le produit rejoint votre sélection : désignation, référence, photo, prix
>    relevé et date du relevé. L'icône de l'extension affiche le nombre de
>    produits.
> 3. Dans Artinova, cliquez sur « Importer la sélection » depuis un devis ou
>    la Bibliothèque. Vous vérifiez les produits, les prix HT ou TTC et vos
>    marges avant l'import.
>
> Vos produits restent dans votre navigateur jusqu'à leur import dans
> Artinova. Ils expirent au bout de 7 jours. L'extension ne collecte aucune
> donnée et ne communique avec aucun serveur Artinova.
>
> L'extension nécessite un compte Artinova pour importer la sélection.

**Captures d'écran** (1280 × 800) : le bouton sur une fiche produit, la
sélection dans la fenêtre de l'extension, « Importer la sélection » dans un
devis Artinova, la liste des fournisseurs supportés.

## Single purpose

> The extension lets an Artinova user collect products from supplier websites
> into a local selection and import that selection into Artinova quotes and
> catalog.

## Permission justifications

| Permission                                             | Justification                                                                                                                                                                                                               |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `storage`                                              | Keeps the user's product selection and its images on the device until they import it.                                                                                                                                       |
| `unlimitedStorage`                                     | The selection holds up to 100 products with one resized photo each (a few MB), beyond the default quota.                                                                                                                    |
| `alarms`                                               | Purges products older than 7 days once an hour, even when no page is open.                                                                                                                                                  |
| Host permissions (supplier sites and their image CDNs) | The « Ajouter à Artinova » button is injected only on the supplier sites listed in the extension; the service worker downloads the product photo from the supplier's image host without cookies. No other site is accessed. |
| Content script on `app.artinova.fr`                    | Lets the Artinova web app read the selection the user built (« Importer la sélection »).                                                                                                                                    |

No `tabs`, `scripting`, `activeTab`, `cookies`, `webRequest` or remote code.
The content security policy is `script-src 'self'; object-src 'self'`.

## Privacy (data usage disclosures)

- Data collected: **none**. Product data the user captures stays in
  `chrome.storage.local`; it leaves the device only when the user imports it
  into Artinova from the Artinova web app, which reads it in the same browser.
- No analytics, no tracking, no sale or transfer of data, no remote code.
- Firefox: `data_collection_permissions.required = ["none"]`.
- Privacy policy URL: https://artinova.fr/confidentialite (to confirm before
  submission).

## Notes to the reviewer

> The extension adds a button on product pages of the supplier sites declared
> in host permissions (about 140 French and Belgian building-trade suppliers).
> Product data is read from the page only when the user clicks the button
> (JSON-LD, microdata, meta tags, and a few site-specific selectors). Photos are
> downloaded by the background service worker from the supplier's own image
> host, with `credentials: "omit"`, and stored locally as JPEG data URLs. The
> Artinova web app (app.artinova.fr) reads the selection through a
> `window.postMessage` bridge restricted to its origin. Content scripts are
> shipped unminified. Test account: not needed to try the button; an Artinova
> account is needed only for the import.
