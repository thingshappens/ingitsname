# HSC — The Edit: implementation brief

**Status:** approved product direction for a new third HSC page. This is a build brief, not evidence that the feature, Stripe prices, audio chain, or delivery flow already exist in production.

**Build goal:** add a new, deliberately simple, fully self-service vocal product named **The Edit** to HSC. It must run automatically after payment: no manual Logic work, microphone recording, bespoke sound design, or human fulfilment.

## 1. Product architecture — preserve what exists

Do **not** remove, rename, degrade, or replace the existing products.

| Product | Job | Interaction |
|---|---|---|
| **Tailor** | Customer needs something outside the fixed system. | Quote request; HSC may create a bespoke solution. |
| **Atelier** | Customer wants to sound-design and control parameters. | Existing open control surface and existing generation/delivery behaviour remain intact. |
| **The Edit** | Customer wants a clean, finished result quickly. | Phrase + voice + BPM + a few curated choices; no technical controls. |

The Edit is **not** a reskin of Atelier and must never gain an Advanced panel. If a customer wants Pitch, Reverb, Echo, Phone, Bitcrush, Width, reverse, etc., send them to Atelier.

Suggested navigation/card copy:

> **The Edit**  
> Pick two sounds. Get two finished cuts.

Secondary link: `Want every control? Enter the Atelier.`

Preserve the existing HSC black / ivory / muted-gold editorial identity. The product copy is allowed to be blunt and modern; it does not need to imitate an old-fashioned luxury house.

## 2. Commercial offer

The Edit is one product family with two quantities. The four sound names below are **choices inside the purchase**, not four separate paid products.

| Checkout choice | Delivery | Price |
|---|---:|---:|
| **The Edit** | Any 2 selected cuts | **USD 9** |
| **The Full Edit** | Any 4 selected cuts | **USD 15** |

Customer behaviour:

1. The customer writes one phrase, chooses one voice and enters one BPM for the order.
2. The page contains 2 cut slots by default.
3. Each slot has a sound choice. The customer may select the same sound more than once **only when its configuration differs**. In practice, this matters for Chopped Up.
4. When the customer tries to add cut 3, show an unobtrusive upgrade: `Add 2 more cuts for $6 — make it a Full Edit.`
5. The exact same selection must not be accidentally bought twice in the same order. Either disable it or require a genuinely different Chop configuration.

The product is priced for curation and certainty, not for a raw WAV count. Atelier can remain at its current offer and price. Do not change the existing Producer Pack, Tailor, existing promotion-code configuration, or any existing Stripe product while implementing The Edit.

The existing first-20 / 20%-off campaign is intended for the existing USD 39 Producer Pack, **not** The Edit.

## 3. Customer flow and UI

### Page route and entry

Add a new standalone route using the app's existing route conventions, for example `/edit`. Do not take over the current Atelier route.

The page order:

1. **Hero**
   - Eyebrow: `HSC PRESENTS`
   - Heading: `THE EDIT`
   - Supporting copy: `Pick two sounds. Get two finished cuts.`
   - Brief promise: `No menus. No fiddling. Just pick a voice and make it hit.`
2. **Input**
   - Phrase input, using the same safe maximum length and validation as existing Vocal functionality unless a deliberate product decision changes it.
   - Voice selector, using only voices that are licensed and technically available to the production renderer.
   - BPM input with clear valid bounds and the same BPM semantics as current HSC. Do not claim sync if the renderer does not actually use BPM.
3. **Your cuts**
   - Two large slots (`Cut 01`, `Cut 02`), with a clear add-two upgrade after the first two are filled.
   - Each chosen cut shows its short description and, where relevant, its only permitted musical choices.
4. **Order summary and checkout**
   - Show selected cuts, price, WAV format, and a concise commercial-use/licensing link before checkout.
   - Payment CTA must state the actual price selected: `Get 2 cuts — $9` or `Get 4 cuts — $15`.
5. **Success / fulfilment state**
   - Do not present a paid order as complete until all requested assets are actually rendered and downloadable.
   - Show a resilient order status, re-openable from the success URL or a secure order link.

The customer should understand the page without seeing an effect percentage, semitone value, dB value, or a technical audio term.

## 4. The four sound choices

All recipes must be tuned, capped and quality-controlled by HSC. A selected style is a promise of a result, not a starting point for customer tweaking.

### 4.1 Clean As Fuck

**Customer promise:** `Clean spoken vocal with just enough reverb to feel finished.`

There are **no controls**. It must not be completely dry, but the reverb must never make diction blurry or make a spoken phrase sound like a generic EDM wash.

### 4.2 Dark & Echo

**Customer promise:** `Low-pitched vocal with controlled echo.`

There are **no controls**. The pitch amount must be selected by the HSC recipe per source voice range so a naturally low voice is not driven into mud and a light voice is not left weak. Echo must be tempo-synchronised to the order BPM if the current engine supports this reliably; otherwise use a tested fixed timing and do not label it BPM-synced.

### 4.3 Sexy Robot

**Customer promise:** `Synthetic, glitchy, raspy vocal.`

There are **no controls**. Start from the existing Glitch character that has been found to sound good, then constrain it so intelligibility and impact survive. Avoid generic novelty-vocoder / cartoon-robot results.

### 4.4 Chopped Up

**Customer promise:** `BPM-synced vocal rhythm.`

This is the sole style with customer-facing subchoices because rhythm is the product:

| Choice | UI label | Intended musical result |
|---|---|---|
| Groove | `Straight Beat` | Familiar, stable pulse on the standard grid. |
| Groove | `Groovy Triplet` | Predictable triol subdivision with bounce and off-grid tension. |
| Groove | `Double Chop` | Same safe, repeatable logic at double density. |
| Cut amount | `Half Chopped` | About half of each gate cycle is audible; phrase remains readable. |
| Cut amount | `Small Cuts` | Around one fifth of each gate cycle is audible; short, percussive stabs. |

The chop envelope is **always tight**. Do not expose `Smooth`, `Edge`, duty-cycle percentages, or any other chopping controls. They belong in Atelier if they belong anywhere. The output must use a consistent pattern through the whole phrase; no automatic builds, acceleration, surprise performance pattern, or pseudo-random slicing in The Edit.

## 5. Audio-production requirements

This section is a production standard. The builder must implement only what the actual audio/rendering stack can reliably execute, and must listen-test with representative male, female, low, bright, short and long phrases before launch.

### Required delivery standard

- Deliver each purchased cut as a **48 kHz WAV**. Use 24-bit PCM when the renderer/export stack supports it consistently.
- Export individual files plus a ZIP for multi-cut orders.
- Use predictable filenames, for example `HSC_TheEdit_CleanAsFuck_128BPM.wav`.
- Do not include an HSC watermark, demo beat or surprise music bed in the paid WAV.
- Avoid clipped samples, abrupt unwanted tails and wildly different perceived levels between the two/four delivered cuts.

### Shared clean master chain

Use a conservative, recipe-controlled post-processing chain after voice generation and style effects:

1. Remove DC / unusable low-end rumble and only apply corrective EQ where needed.
2. Apply de-essing or dynamic high-frequency control only when sibilance needs it.
3. Apply transparent compression for consistency; aim for roughly 2–4 dB gain reduction on typical phrases, not an audibly crushed voice.
4. Apply make-up gain carefully, then a true-peak limiter as final protection. Ceiling: **-1 dBTP**.
5. Loudness-match the delivered cuts closely enough that switching between an order's selections does not create a large jump. Treat loudness as a listening target, not a reason to over-compress very short samples.

This shared master chain must not erase the intentional contrast between Clean, Dark, Robot and Chop. It must make every result finished, controlled and usable in a DJ/producer workflow.

### Preset-specific guardrails

- **Clean As Fuck:** subtle room/plate-style reverb, pre-delay and decay tuned for clarity; preserve consonants; no excessive stereo wash.
- **Dark & Echo:** use voice-aware pitch mapping rather than one blindly fixed amount for all voices; filter echo repeats so they sit behind the lead; cap feedback/tail so the phrase remains usable over a mix.
- **Sexy Robot:** keep the chosen glitch texture intentional; do not allow artifacts to swallow the phrase or introduce unpleasant harshness.
- **Chopped Up:** grid must use the entered BPM; Straight, Triplet and Double must resolve to familiar, head-noddable subdivisions; use tight gating with 50%-ish and 20%-ish audible duty modes. Trim/render tails deliberately so a DJ can place the asset predictably.

### Mandatory listening QA before production release

Make a fixed internal test set using the same phrase across multiple voices and BPMs (including at least 110, 128 and 140 BPM). A human must approve every combination offered in the UI, especially all six Chop combinations. If a voice/style combination cannot pass, map it to a safer recipe or hide that unsupported combination.

Do not write “perfect”, “studio-ready” or “BPM-synced” in live copy until this QA has been performed on the deployed renderer.

## 6. Order data and rendering model

Store an order and its cuts server-side. The browser is not the source of truth.

Minimum conceptual model:

```text
Order
  id
  product: the_edit
  cutCount: 2 | 4
  phrase
  voiceId
  bpm
  status: draft | awaiting_payment | paid | rendering | ready | failed
  stripeCheckoutSessionId
  stripePaymentIntentId (when present)
  createdAt / updatedAt

EditCut
  id
  orderId
  slot: 1..4
  style: clean | dark_echo | sexy_robot | chopped_up
  groove: straight | triplet | double (required only for chopped_up)
  cutAmount: half | small (required only for chopped_up)
  recipeVersion
  outputUrl
  renderStatus
```

`recipeVersion` matters: it lets HSC reproduce and investigate an order after tuning future recipes, without silently changing a customer's historical delivery.

Validate all fields server-side. Never trust a client-supplied price, cut count, voice availability, or style configuration.

## 7. Stripe implementation requirements

Use the existing HSC Stripe account and integration pattern after first locating the actual HSC repository and existing Vercel project. This brief does **not** authorize changing live Stripe products from this unrelated workspace.

Create two new Stripe Prices in **test mode first**:

- `The Edit — 2 cuts`: USD 9.00
- `The Full Edit — 4 cuts`: USD 15.00

Production identifiers must be configured as environment variables in Vercel, for example:

```text
STRIPE_PRICE_THE_EDIT_2
STRIPE_PRICE_THE_EDIT_4
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
```

Never expose secret keys in GitHub, client bundles, logs, screenshots or markdown files.

### Payment and fulfilment sequence

1. Create a server-side draft order with validated selections.
2. Create a Stripe Checkout Session with the correct server-selected Price and only an internal order identifier in Checkout metadata.
3. Redirect to Stripe Checkout.
4. Treat a verified server-side `checkout.session.completed` webhook as the authority to mark the order paid and enqueue rendering. The success redirect alone is not proof of payment.
5. Make webhook handling idempotent. Replayed events, refreshes, browser back-button use and queue retries must never create duplicate charged orders or duplicate renders.
6. When every cut is ready, issue secure, time-limited downloads or an authenticated order-download page. Do not use public permanent URLs for paid audio.

Do not put the phrase in Stripe metadata unless there is a documented, privacy-reviewed reason. An internal order ID is enough.

The existing `FOUNDING20` / first-20 promotion should remain scoped to the existing USD 39 Producer Pack. Do not apply it to The Edit unless that is later explicitly approved.

## 8. GitHub and Vercel delivery discipline

The current working directory used to create this brief is **not confirmed to be the live HSC application repository**. The implementation session must first locate the real repository, GitHub remote, Vercel project and the deployed route used by `atelier.hautesoundcouture.com`.

Before editing:

1. Read the real repository's `AGENTS.md`, README and existing payment/rendering code.
2. Record current git status; preserve unrelated user changes.
3. Identify the live Vercel project and its existing production environment variables without printing their values.
4. Confirm the existing Atelier, Tailor, Google/analytics tracking and checkout flow still work before touching them.

Implementation discipline:

- Create a focused branch, for example `feat/the-edit`.
- Keep the change additive: new route, new server-side order/render path, new Stripe Prices/configuration and tests. Do not rewrite Atelier.
- Deploy to a Vercel Preview environment first using Stripe test mode.
- Configure test-mode webhook delivery to that preview/staging endpoint and prove the complete render/download sequence.
- Only after review, set the production variables, create the production prices, register/verify the production webhook, and deploy the approved branch.
- Preserve existing Google tags and tracking. Add events only if they do not replace or break existing instrumentation.
- Open a GitHub pull request with a concise description, screenshots of the new page, a test checklist and known limitations.

Suggested non-sensitive analytics events:

```text
the_edit_viewed
the_edit_cut_selected
the_edit_full_upgrade_shown
the_edit_full_upgrade_accepted
the_edit_checkout_started
the_edit_paid
the_edit_render_ready
the_edit_downloaded
```

Do not send the customer's phrase or generated audio URL as analytics event properties.

## 9. Acceptance checklist

The feature is not done merely because a page renders. A builder may call it ready only when all of the following have been checked:

- [ ] Tailor and Atelier remain available and unchanged in their core behaviour.
- [ ] The Edit presents exactly the approved choices and no technical/advanced controls.
- [ ] A 2-cut order is priced at USD 9 and a 4-cut order at USD 15 in Stripe test mode.
- [ ] A customer can choose two different styles, or two distinct Chopped Up variants.
- [ ] Duplicate identical cut configurations cannot be accidentally ordered in one purchase.
- [ ] Chopped Up offers only Straight Beat, Groovy Triplet, Double Chop, Half Chopped and Small Cuts.
- [ ] BPM is genuinely applied to every Chop render.
- [ ] The audio test set has been manually auditioned; no clipping, unintelligible default result, accidental reverb wash, cartoon robot or unreliable chop pattern is shipped.
- [ ] Downloaded assets are 48 kHz WAVs and a multi-cut order includes all assets exactly once.
- [ ] Stripe webhook verification, idempotency and secure post-payment download are tested end-to-end in test mode.
- [ ] Refreshing the success page or replaying the webhook does not charge, render or deliver twice.
- [ ] Existing checkout/payment paths still pass a smoke test.
- [ ] The production deployment is not described as complete until the live test purchase, delivery and analytics events have been verified.

## 10. Explicitly out of scope for this build

- Do not build DJ Pack or Exclusive HSC Identity Pack in this change. They are subsequent product concepts.
- Do not add social-media publishing, Metricool automation, ads, new API keys or external account changes.
- Do not create customer-specific manual Logic sessions.
- Do not make legal claims of global AI-audio exclusivity.
- Do not turn The Edit into Atelier by adding pitch, reverb, echo, glitch, edge, percentage or advanced controls.

## 11. Builder hand-off prompt

Use this as the opening instruction to the implementation session:

> Implement **The Edit** in the actual HSC Atelier repository and Vercel project, following `THE_EDIT_IMPLEMENTATION_BRIEF.md` exactly. First identify the live repository/project and inspect the current Tailor, Atelier, Stripe and audio-rendering paths. Keep all existing functionality, tracking and live payments intact. Build only the additive The Edit route and its secure automated Stripe-to-render-to-download flow. Use a preview deployment and Stripe test mode for end-to-end verification before proposing any production change. Do not claim an audio recipe, payment flow or deployment is live unless you have actually tested it.
