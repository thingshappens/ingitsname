# The Edit — candidate implementation

Status: candidate implementation, now migrated at code level from the former ElevenLabs renderer to a private Voicebox gateway adapter. NOT production-ready or deployed. The live preview/payment/download sequence, private GPU worker, human voice QA and provider decision remain unverified. Keep `THE_EDIT_ENABLED=false` until every release gate is verified.

## Monsieur Lousive four-cut product contract — 2026-09-09

The Edit is no longer a two-cut selector. The local candidate now has one fixed customer package. **Monsieur Lousive is its first pilot character, not a product-wide hardcode:** each future approved HSC character can enter the same pack through an explicit private Voicebox profile and the `hsc-four-cuts-v1` cut-set contract.

> **One Phrase. Four Cuts.**

The customer provides a phrase, selects Monsieur Lousive and BPM, then previews and receives all four named cuts in this exact order:

1. **Flat Tag Cut** — dry, direct Monsieur source character.
2. **Clean Cut** — polished clean delivery.
3. **Dark Echo Cut** — low, spacious pressure treatment.
4. **Sexy Synthetic Cut** — the customer-facing name for the Logic-approved Sexy Robot treatment.

This is enforced server-side: browser-provided cut selections are ignored and the order model derives the four-cut sequence itself. Individual previews remain available, but an order is always the full package. The UI deliberately says `One Phrase. Four Cuts.` and does not expose plugin controls, effect parameters or a customer choice between the four cuts.

**Critical release boundary:** this is a local product contract and UI/order-model change only. The customer-facing names describe the approved Logic v02 references; the current programmatic renderer is not evidence that it recreates those Logic chains. Keep orders closed until the private Voicebox/GPU renderer produces, stores and previews the exact approved four-cut output for representative phrases and BPMs. Price and payment-provider finalization remain separate product decisions; no live checkout or production price was changed here.

## Voicebox/Monsieur Lousive vertical slice — 2026-09-08

- The customer-facing voice selector now admits only explicit HSC Voicebox profiles from `THE_EDIT_VOICES_JSON`. The approved local candidate is presented to customers as **Monsieur Lousive — Flat Tag**. Its current Voicebox workspace name is `Monsieur Felix Lousive`; that private workspace name must never be shown in customer UI or copy. A safe configuration has the shape:

  ```json
  {
    "id": "monsieur_lousive_flat_tag_v1",
    "name": "Monsieur Lousive — Flat Tag",
    "range": "mid",
    "licensed": true,
    "provider": "voicebox",
    "profileId": "VOICEBOX_PROFILE_UUID",
    "engine": "chatterbox_turbo",
    "language": "en",
    "voiceProfile": "masculine",
    "profileVersion": "flat-tag-v1"
  }
  ```

- `profileId`, engine and model size are server configuration. The browser only receives `id` and `name`; it cannot select an arbitrary Voicebox profile, engine, URL or model.
- `THE_EDIT_VOICEBOX_URL` and `THE_EDIT_VOICEBOX_TOKEN` point to an HSC-authenticated private gateway, not a raw public Voicebox endpoint. The adapter calls `POST /generate` then `GET /audio/{generationId}` and converts the returned WAV to the existing HSC 48 kHz render pipeline.
- Preview responses include `X-HSC-Generation-ID`. The next implementation slice must persist preview assets and their `generationId` before checkout, so a paid download unlocks the exact preview rather than a later rerender.
- No new The Edit render path calls ElevenLabs or uses `ELEVENLABS_API_KEY`.

The local source profile selected by the HSC operator is **Monsieur Lousive — Flat Tag**. It is a separately cloned Voicebox profile with four new long-form English pronunciation references. In a direct same-phrase local A/B audition on 2026-09-08, the operator selected it over the earlier imported `Monsieur Lousive` profile on all criteria. Its local profile UUID is not production configuration: export/import it to the GPU worker first, then use the worker's confirmed profile UUID in `THE_EDIT_VOICES_JSON`.

### Mandatory local gate before GPU

Run `Run Monsieur Lousive Local Test.command` with the Voicebox desktop app open. It discovers the approved local Flat Tag candidate, starts a loopback-only HSC gateway, generates one phrase using Chatterbox Turbo, applies the three HSC recipes and writes WAVs plus a manifest. Listen to every WAV before proceeding. This proves the audio route, profile routing, gateway token and HSC DSP locally; it does **not** prove public hosting, payment, customer preview persistence or commercial readiness.

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

48 kHz mono 24-bit PCM WAV. Recipe version is saved per cut and pinned in the renderer. Future versions must retain old recipe implementations while orders remain reproducible.

- Clean: the selected voice in original pitch and timing, without creative EQ, compression, de-essing, pitch or echo; only export peak safety and a short end fade remain.
- Dark Echo: **locally sound-approved v1** on 2026-09-08. It is a fixed -3 semitone delivery plus one dotted-eighth echo tied to BPM. The HSC operator approved its tone, intelligibility after pitch drop and perceived reverb/echo amount. It deliberately has no additional tone filter, repeat tap, room reflection, robotisation or gate. This approval applies to Monsieur Lousive — Flat Tag at 128 BPM only; it is not a deployment or full cross-BPM/phrase release approval.
- Sexy Robot: the earlier programmatic Voicebox/FFmpeg candidates, including `v5`, are retired as product sound-design candidates. On 2026-09-08 the HSC operator created and approved **Sexy Robot v01** in Logic Pro. The local source of truth is `outputs/Channel strip settings/HSC_SexyRobot_01.cst`, with the accompanying Logic project in `outputs/kitchen-inputs/Logic files/HSC_SexyRobot_v01/`. Its fixed channel-strip order is Channel EQ → ChromaVerb → Robo Flanger → Pitch Shifter → Flanger → Compressor; two phrases were approved through the same strip at 128 BPM: `HSC_SexyRobot_GoldMaster_v01_128.wav` and `HSC_SexyRobot_v01_ProofPhrase_128.wav`. This establishes creative repeatability for the two tested phrases. It does not yet establish unattended server rendering, cross-BPM approval, arbitrary-phrase approval, customer preview, payment or delivery.
- Chop: constant eighth / eighth-triplet / sixteenth cycle with 50% / 20% audible window and 1.5 ms edges; no changing density.
- Dark/Robot use their own candidate processing. Export applies peak safety, a deliberate tail fade and independent true-peak measurement of the actual final 48 kHz file. Export fails if measured true peak exceeds -1 dBTP. Short-sample loudness and timbre require listening approval.

Clean is approved as the unprocessed reference, not as a finished commercial effect. Dark Echo v1 is locally sound-approved for the stated reference test. Sexy Robot v01 is **locally sound-approved in Logic for its two stated 128-BPM proof phrases**, but has no automated renderer yet. Every other creative recipe remains a candidate. Silence/generation above 25 seconds fails safely. Human QA must confirm cross-BPM/cross-phrase behavior and that limiting long generated phrases is commercially acceptable before opening orders.

## Preview configuration

Use the environment names in `.env.example`. The separate THE_EDIT_STRIPE_SECRET_KEY and THE_EDIT_WEBHOOK_SECRET isolate The Edit from existing checkout settings. Do not change existing STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET.

Configure `THE_EDIT_ORIGIN` as the stable preview origin; register the test webhook at that origin's `/api/the-edit-webhook` for checkout.session.completed and checkout.session.async_payment_succeeded. Stripe must be able to access that endpoint through preview protection using an approved webhook-access configuration. Do not disable protection broadly.

The preview needs the private Voicebox gateway URL/token, Redis access and a payment-provider test credential only when checkout work is resumed. Set explicit HSC Voicebox entries only after confirming source rights, profile ID, engine and renderer availability. Production additionally requires `THE_EDIT_QA_APPROVED_VERSION` matching the recipe and `THE_EDIT_TERMS_URL` with approved commercial-use terms. The preview currently keeps these unset and orders closed.

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
