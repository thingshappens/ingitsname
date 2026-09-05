# The Edit — candidate implementation

Status: candidate deployed to a protected Vercel Preview, with automated service/audio checks. NOT production-ready. The live checkout/render/download sequence and human voice QA remain unverified. Keep THE_EDIT_ENABLED=false until preview credentials, rights and the full test chain are verified.

## Scope

Additive `/edit/` page, `/api/the-edit` action endpoint and `/api/the-edit-webhook`. Existing `index.html`, `src.js`, `style.css`, existing API endpoints, Google tags and live Stripe products are unchanged. Vite now builds both pages. Production repo: thingshappens/ingitsname; project: hsc-deep-echo; public host: atelier.hautesoundcouture.com.

The user-approved brief specifically requires a feature branch and preview before production. That supersedes the older AGENTS.md instruction to use the production branch directly for this change.

## Payments and access

- Two test-mode Prices under one new Product in the existing HSC Stripe account: 900 cents `price_1UC9cBC1z3kdS6aDOOiog0O7`; 1500 cents `price_1UC9dCC1z3kdS6aDLPNDrfwh`. Product `prod_VCYjL1UOB3NCx5`.
- Server validates phrase (1–120 characters), integer BPM (60–200), explicit licensed voice allowlist, cut count and configuration uniqueness. It validates Stripe Price amount/currency/mode before checkout.
- Client-generated random request ID and 256-bit access token identify retries. Only the token hash is stored. Phrase never enters metadata or analytics. Stripe metadata contains only the internal order ID. Promotion codes are disabled for The Edit.
- Verified raw-body Stripe webhook checks environment, session ID, amount, currency and exact line item. Redirect and browser polling cannot mark orders paid.
- Redis NX lease prevents concurrent fulfilment; checkpointed source/cuts resume on webhook retry. Stripe retries non-2xx webhook responses. Ready orders are never regenerated on replay.
- Paid status is persisted before rendering. Failed work remains in a Redis pending set. A returned success URL is not delivery success.
- Order access token is carried in the URL fragment, not query string, and sent to the API in POST bodies. Downloads authenticate it and require the entire order to be ready. No public paid-audio URLs are created.
- Binary audio is stored as private Redis chunks, with 7-day expiry. Metadata expires after 90 days. WAV downloads are individually under the serverless payload limit (source capped at 25 seconds; longest tail 2.25 seconds). The browser builds a ZIP from the same authenticated WAV files to avoid the serverless combined-response limit.

## Candidate audio recipes

48 kHz mono 24-bit PCM WAV. Recipe version `edit-v1-candidate-1` is saved per cut and pinned in the renderer. Future versions must retain old recipe implementations while orders remain reproducible.

- Clean: short, low-level early-reflection reverb candidate.
- Dark: voice-range mapping (-1/-2.5/-4), duration-compensated pitch, filtered finite echo repeats tied to BPM.
- Robot: restrained adaptation of Atelier's deterministic glitch, dry voice blend, subtle crusher and high-frequency cap.
- Chop: constant eighth / eighth-triplet / sixteenth cycle with 50% / 20% audible window and 1.5 ms edges; no changing density.
- Shared highpass, conditional de-essing, compression, constant gain toward -18 LUFS where sensible, 4x oversampled limiter, deliberate tail fade and independent true-peak measurement of the actual final 48 kHz file. Export fails if measured true peak exceeds -1 dBTP. Short-sample loudness and timbre require listening approval.

The current Clean reverb and all other recipes are candidates, not approved sound design. Silence/generation above 25 seconds fails safely. Human QA must confirm that limiting long generated phrases is commercially acceptable before opening orders.

## Preview configuration

Use the environment names in `.env.example`. The separate THE_EDIT_STRIPE_SECRET_KEY and THE_EDIT_WEBHOOK_SECRET isolate The Edit from existing checkout settings. Do not change existing STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET.

Configure `THE_EDIT_ORIGIN` as the stable preview origin; register the test webhook at that origin's `/api/the-edit-webhook` for checkout.session.completed and checkout.session.async_payment_succeeded. Stripe must be able to access that endpoint through preview protection using an approved webhook-access configuration. Do not disable protection broadly.

The preview needs the existing voice-service credential and Redis access, plus a Stripe test credential. Set explicit voice allowlist entries `{id,name,range,licensed:true}` only after confirming rights and renderer availability. Production additionally requires THE_EDIT_QA_APPROVED_VERSION matching the recipe and THE_EDIT_TERMS_URL with approved commercial-use terms. The preview currently keeps these unset and orders closed.

## Verification performed

- `npm test`: service validation, idempotent checkout, invalid payment rejection, concurrent lease, retry checkpoints, six Chop grids across 110/128/140 BPM, true WAV format/true-peak checks, raw webhook signatures, replay age and live/test separation.
- `npm run build`: both entrypoints build.
- Codex browser: real local page renders without JS errors; 2/4 upgrade/downgrade, configuration exclusions and distinct Chop defaults confirmed; 390 px mobile has no horizontal overflow or technical sliders. Desktop/mobile screenshots accompany the PR.
- Playwright UI suite is provided with explicitly mocked config/payment responses. Its attempted local run could not launch a browser in this sandbox; do not mark it passed.

## Remaining release gates and limitations

1. Preview deployment exists at https://hsc-deep-echo-qii7yqs24-mikaellarlek-gmailcoms-projects.vercel.app/edit/ (commit b2df58d). Page opened through normal authenticated browser access; deployed config endpoint returned 200, preview=true, enabled=false. Credentials and accessible signed webhook endpoint remain unconfigured.
2. Real Stripe test purchases for both quantities; re-open success URL in another browser; download all WAVs and ZIP; verify unauthorized/unpaid/expired access is rejected; replay event concurrently and after completion.
3. Human audition of every offered voice across all 9 style/configuration choices, short/long phrases and 110/128/140 BPM; run the same renderer on the deployed platform. Record approval in QA.csv. Do not claim BPM-synced/perfect/studio-ready in live copy until approved.
4. Confirm current voice rights and commercial-use terms. No voices are published from an assumed license.
5. Check Redis memory/bandwidth capacity against launch volume. Chunked private storage is deliberately simple for this small product; a larger launch needs capacity evidence or private object storage.
6. Stripe webhook retries provide bounded recovery, not an indefinitely running queue worker. Pending/failed jobs require operational alerting and a defined refund/recovery policy before launch. Crash between a provider response and its storage checkpoint may repeat provider generation; saved cuts and successful deliveries are not repeated. Do not promise exactly-once provider calls across a process crash.
7. The new page initializes the existing Google destination only on the production custom domain, with sanitized page location and no phrase/audio URL. Paid/render-ready events are structured server logs without order or customer details. Analytics delivery and live instrumentation verification remain outstanding. Existing instrumentation is preserved.
8. Home page production responded 200 with the expected Google tag and current bundle; its HTML was byte-for-byte identical before/after this work, and no live purchase was made. Tailor and old payment end-to-end smoke tests remain release gates.

No production deployment, live prices, broad secret extraction, or production promotion was performed.
