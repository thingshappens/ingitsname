# STATUS — Haute Sound Couture (hautesoundcouture.com)

Last updated: 2026-09-27

## Nu

- **Waiting for Paddle approval.** The live account returns `transaction_checkout_not_enabled` ("Checkouts aren't enabled… haven't fully completed the Paddle onboarding"). The owner has to finish onboarding in vendors.paddle.com: Home checklist, website approval for hautesoundcouture.com, default payment link `https://hautesoundcouture.com/edit/`. Until then, visitors who try to buy see "temporarily unavailable". No one can be charged.
- **Check whether Paddle is enabled:** `gh workflow run set-secrets.yml -R thingshappens/ingitsname --ref edit-sandbox-diag` and read the log (`"id":"txn_…"` = enabled). Only `set-secrets.yml` can be dispatched, so it is reused for diagnostics on the `edit-sandbox-diag` branch.
- **Atelier checkout is not live-ready.** The live Paddle account has the prices (Atelier 4-cut $12, 20-cut Producer Pack $39, product `pro_01m35pdsk105q1mntkppkxm963`), but the Worker's `PADDLE_PRICE_ATELIER_PACK` is not a live price ID, and `PADDLE_PRICE_ATELIER_4` is not in `HSC_BULK_SECRETS`. `ATELIER_PAYMENT_PROVIDER` decides Stripe or Paddle (default Stripe).

## Klart

- 2026-09-25 — The Edit: sandbox purchase tested end to end (pay → webhook → RunPod cuts → WAV + ZIP download).
- 2026-09-25 — Live Paddle values verified and set on the Worker: API key, client token, The Edit price ($12), webhook secret (events `transaction.completed`, `transaction.paid`), `PADDLE_ENVIRONMENT=production`. The owner-code gate turned off automatically.
- 2026-09-25 — "Hear cut" previews are public on the live site: 12 per visitor per hour, 120 per hour site-wide. They run on RunPod via the same `fulfil` job as paid orders.
- 2026-09-25 — RunPod worker v6: `pedalboard` pinned to 0.9.20. 0.9.21+ Linux wheels contain AVX-512 and crash with SIGILL on AMD EPYC 7352 hosts (spotify/pedalboard#454).
- 2026-09-25 — RunPod calls use `runsync` plus 4 s polling. Polling every 0.75 s hit Cloudflare's per-request subrequest limit.
- 2026-09-27 — Pricing page `/pricing/` (The Edit $12, Atelier $12 / $39), linked in the footer. The Edit's button shows "Get the files · $12".

## Backlog

- After Paddle approval: open the live checkout, then have the owner do one real $12 purchase and refund it in Paddle.
- Atelier live checkout: decide Paddle vs Stripe, set the live price IDs on the Worker, and test it.
- The Atelier page says the Producer Pack saves "$6". 5 × $12 = $60 vs $39 means it saves $21. Check the wording.

## Rules

- Going live on Paddle = only swapping secret values, no code redesigns. Ask first if something seems to need more.
- Crypto payments are not part of the plan. `node:crypto` in the code is Node's hashing module.
- RunPod image: a GitHub release `runpod-worker-vN` on branch `feat/runpod-worker` builds and deploys it.
