# HSC repository instructions

- The application source for the whole site (Home, Maison, Atelier, The Edit, Tailor, APIs) is in this repository.
- `main` is the production branch. Make all changes on `main`, including Atelier work.
- Pushing to `main` deploys to Cloudflare Workers via `.github/workflows/deploy.yml`. Every push deploys, including docs-only changes.
- After pushing, verify that the `Deploy to Cloudflare Workers` GitHub Actions run succeeded and that the live site responds correctly.
- Do not create another repository or long-lived branch for site work.
- Legacy, do not use: the `marketing-automation` branch and the Vercel projects `hsc-deep-echo` / `hsc-bespoke-studio`. They predate the move to Cloudflare (2026-09-22) and no longer serve the live site.
