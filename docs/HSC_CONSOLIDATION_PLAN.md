# HSC public web consolidation

Status: migration plan, not yet published.

## Target

One public HSC application and one production deployment should own the public
routes, navigation, analytics bootstrap and SEO metadata:

| Public URL | Route owner | Current source |
| --- | --- | --- |
| `hautesoundcouture.com/` | Maison | HSC Sites source clone (`/tmp/hsc-maison-source`) |
| `hautesoundcouture.com/atelier/` | Atelier | `ingitsname/index.html` and `src.js` |
| `hautesoundcouture.com/the-edit/` | The Edit | `ingitsname/edit/` and `/api/the-edit*` |
| `hautesoundcouture.com/tailor/` | The Fitting Room | Separate `hsc-bespoke-studio` deployment; source still to be recovered |

The existing subdomains remain compatibility aliases during migration:

`atelier.hautesoundcouture.com` → `/atelier/`,
`theedit.hautesoundcouture.com` → `/the-edit/`, and
`tailor.hautesoundcouture.com` → `/tailor/`.

## Non-negotiable migration rules

- Freeze the currently verified Maison, Atelier and four-cut The Edit before
  moving their UI.
- Do not copy `Voicebox/`, model caches, secrets or generated customer audio
  into Git.
- Keep product APIs and payment entitlements server-side; route consolidation
  must not make checkout state client-owned.
- Preserve existing public subdomains until the root-domain routes have passed
  browser verification.
- Do not call the migration live until every route, custom domain, analytics
  tag and canonical URL has been verified.

## Analytics contract

The consolidated app will load one GA4 property and the existing Ads tag once
from the root layout. Product routes emit only non-sensitive events:

`page_view`, `product_view`, `start_atelier`, `start_edit`, `start_quote`,
`checkout_started`, and `download_ready`.

Phrases, audio URLs, access tokens, order IDs and private quote details must
never be sent as analytics properties.

## Migration order

1. Copy Maison's public visual/content source into a new route without
   changing the live Maison deployment.
2. Mount Atelier and The Edit below the same app shell while keeping their
   current API routes and payment configuration unchanged.
3. Recover the Fitting Room source and mount it at `/tailor/`; verify its quote
   endpoint before directing traffic there.
4. Add the shared analytics/SEO layout and verify each route with Tag Assistant
   and browser checks.
5. Switch the root domain and compatibility aliases only after all four routes
   are verified from the same production commit.

