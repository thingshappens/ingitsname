# Tailor recovery evidence

Status: public deployment verified; Git source not recovered yet.

## Deployment

- Project: `hsc-bespoke-studio`
- Project ID: `prj_GXDMEgUMCCQbrYeYGtMd23bL6yl0`
- Public deployment: `https://hsc-bespoke-studio.vercel.app/`
- Latest inspected production deployment: `hsc-bespoke-studio-mflbkyg9e-mikaellarlek-gmailcoms-projects.vercel.app`
- Vercel inspection: `target=production`, `gitSource=null`, `source=null`

This is a Vercel-only deployment. Do not delete it or repoint its domain until
the recovered replacement passes the same flow checks.

## Verified public UI

The public page identifies itself as **The Fitting Room · Private
Commissions** and presents six steps:

1. The project
2. Material
3. Character
4. Collection/cut
5. Timing and budget
6. Details

The initial state visibly calculates a non-binding **$260–360 USD** atelier
range for the default selections. The final quote remains a human HSC decision.

## Assets and analytics

Observed public assets include:

- `/assets/index-nTvZ61Ni.js`
- `/assets/index-M4E58Pit.css`
- `/hsc-logo.png`

The page loads Google Analytics 4 property `G-QGMG5DTDXQ`. This matches the
Atelier property and is the analytics ID to preserve in the consolidated app.

## Recovery boundary

The published JavaScript contains the calculator state and submission flow, but
the original source repository is not connected to Vercel and was not found in
the local Documents search. Recover the route into the canonical HSC repository
as a new implementation; do not claim the source has been restored until the
calculation and submission endpoint are independently verified.

