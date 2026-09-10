# HSC Control Plane

This file is the operational source of truth for HSC web products. Update it in the same commit as any change to a product, custom domain, deployment source, analytics, or public status.

## Publishing rule

`marketing-automation` is the only HSC production source branch. Vercel production must deploy from that branch. Once the custom domains have been verified against its deployment, fast-forward `main` to the same commit. Do not attach a customer-facing domain to a preview branch or to a manual deployment.

## Product map

| Product | Public entry | Source | Hosting | Public status |
| --- | --- | --- | --- | --- |
| Maison | `https://hautesoundcouture.com/` | Google Sites (external to this repository) | Google Sites | Live; links must be checked after every public change. |
| Atelier | `https://atelier.hautesoundcouture.com/` | This repository, `marketing-automation` | Vercel project `hsc-deep-echo` | Production domain. |
| The Edit | `https://theedit.hautesoundcouture.com/` | This repository, `marketing-automation` | Vercel project `hsc-deep-echo` | Page exists; orders remain closed until the required production configuration and end-to-end payment/render checks are complete. |
| Tailor | `https://tailor.hautesoundcouture.com/` | A quote-request surface still needs to be added to this repository | Vercel project `hsc-deep-echo` | Not configured as a Vercel domain at the time this file was added. |
| Cuts | No public web entry selected | Separate product; source and host not selected | Not selected | Planned. |

## Release checklist

1. Work only on `marketing-automation`; keep `Voicebox/` and model caches outside commits.
2. Run `npm test`, `npm run build`, and `git diff --check`.
3. Push the exact commit to `origin/marketing-automation` and confirm Vercel creates the production deployment from that commit.
4. Verify each assigned custom domain loads the expected route and bundle.
5. Verify the customer flow appropriate to that product: quote request, generation, payment, delivery, or download.
6. Confirm analytics on the custom domain and Google Search indexing metadata before calling a public product live.
7. Fast-forward `main` to the verified production commit, push it, and record the commit and date below.

## Latest verified release

No unified verified release has been recorded yet. Fill this section only after steps 1-7 have evidence.

| Date | Production commit | Domains verified | Analytics verified | Owner |
| --- | --- | --- | --- | --- |
| Pending | Pending | Pending | Pending | Pending |
