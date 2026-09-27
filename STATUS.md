# STATUS — Haute Sound Couture (hautesoundcouture.com)

Last updated: 2026-09-27

## Nu

- **Waiting for Paddle approval.** The live account returns `transaction_checkout_not_enabled` ("Checkouts aren't enabled… haven't fully completed the Paddle onboarding"). The owner has to finish onboarding in vendors.paddle.com: Home checklist, website approval for hautesoundcouture.com, default payment link `https://hautesoundcouture.com/edit/`. Until then, visitors who try to buy see "temporarily unavailable". No one can be charged.
- **Check whether Paddle is enabled:** `gh workflow run set-secrets.yml -R thingshappens/ingitsname --ref edit-sandbox-diag` and read the log (`"id":"txn_…"` = enabled). Only `set-secrets.yml` can be dispatched, so it is reused for diagnostics on the `edit-sandbox-diag` branch.
- Atelier charges through Paddle as of 2026-09-27 (`ATELIER_PAYMENT_PROVIDER=paddle`, live prices `pri_01m35pkx50y3pahraxy0qfn6c8` $12 and `pri_01m35q1n4q9tdmrrqewzcxqpw0` $39). It waits on the same Paddle approval as The Edit.

## Klart

- 2026-09-27 — Atelier on Paddle. The Producer Pack accepts Paddle payments (`lib/pack-payment.js`: Stripe `cs_` or Paddle `txn_`, completed/paid + product_key). The 5 fittings are counted in our own credit store (`lib/credits.js`, Redis), not by Paddle. Tests: `test/pack-payment.test.js`. The pricing page shows all three prices via Paddle.

- 2026-09-25 — The Edit: sandbox purchase tested end to end (pay → webhook → RunPod cuts → WAV + ZIP download).
- 2026-09-25 — Live Paddle values verified and set on the Worker: API key, client token, The Edit price ($12), webhook secret (events `transaction.completed`, `transaction.paid`), `PADDLE_ENVIRONMENT=production`. The owner-code gate turned off automatically.
- 2026-09-25 — "Hear cut" previews are public on the live site: 12 per visitor per hour, 120 per hour site-wide. They run on RunPod via the same `fulfil` job as paid orders.
- 2026-09-25 — RunPod worker v6: `pedalboard` pinned to 0.9.20. 0.9.21+ Linux wheels contain AVX-512 and crash with SIGILL on AMD EPYC 7352 hosts (spotify/pedalboard#454).
- 2026-09-25 — RunPod calls use `runsync` plus 4 s polling. Polling every 0.75 s hit Cloudflare's per-request subrequest limit.
- 2026-09-27 — Local prices: The Edit's price on `/pricing/` and its buy button comes from `Paddle.PricePreview` (Paddle's `formattedTotals.total`, shown as-is; USD text as fallback). `/api/paddle-client` fails on purpose if `PADDLE_ENVIRONMENT` isn't `sandbox`/`production`. Paddle variables documented in `.env.example`. Atelier stays in USD until it charges through Paddle.
- 2026-09-27 — Paddle's generic 3-tier subscription template was NOT used: HSC sells one-time custom products, so there's no Starter/Pro/Advanced, no monthly/yearly, and no direct "Subscribe" button (the customer configures the product first).
- 2026-09-27 — Pricing page `/pricing/` (The Edit $12, Atelier $12 / $39), linked in the footer. The Edit's button shows "Get the files · $12".

## Backlog

- Show kr/€ instead of $: add country-specific prices (overrides) to the price in Paddle. The site shows them automatically, no code needed.

- After Paddle approval: open the live checkout, then have the owner do one real $12 purchase and refund it in Paddle.
- After Paddle approval: test Atelier's $12 fitting and the Producer Pack (5 fittings count down) in live.
- The Atelier page says the Producer Pack saves "$6". 5 × $12 = $60 vs $39 means it saves $21. Check the wording.

## Rules

- Going live on Paddle = only swapping secret values, no code redesigns. Ask first if something seems to need more.
- Crypto payments are not part of the plan. `node:crypto` in the code is Node's hashing module.
- RunPod image: a GitHub release `runpod-worker-vN` on branch `feat/runpod-worker` builds and deploys it.
