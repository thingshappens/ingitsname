# HSC marketing chain

This folder is the source of truth for organic marketing. It keeps one idea, one caption and one call-to-action reusable across Instagram Reels, TikTok and YouTube Shorts.

## What is automated now

Run `npm run marketing:brief` to produce the next ready-to-record content brief. It selects from `content-queue.json` and gives the exact hook, frames, caption, hashtags and CTA.

## What remains intentionally disconnected

No social account is connected and nothing is published automatically. Publishing, ads and direct messages need explicit account access and a separate approval step.

## Atelier Dispatch and launch definition

`launch-mvp.json` is the product acceptance contract. HSC Atelier is not launch-ready with Vocal Cuts alone: AI Vocal Cuts, own recorded/curated HSC vocals, Transition FX and DJ Tools are four equal launch pillars. Each needs a real production output and four 48 kHz WAV exports before launch scheduling begins.

`atelier-dispatch.json` remains the reusable content model and video-template contract. It holds `contentType`, name, BPM, character and four output names, with a consistent HSC 1080 × 1920 format. `dj_tool` is kept as a documented extension point; no Dispatch UI or publishing automation is introduced here.

Run `npm run dispatch:brief` to produce the next ready Dispatch brief. It will not select a disabled content type or publish anything.

## Publishing rhythm

Use one master 9:16 export on all three platforms. Publish two posts per week, three to four days apart. The first three queue items are ready while audio credits are unavailable; do not publish the launch items until each sound category has a real, verified demo.

## Metrics that decide the next post

Track only three numbers per post: three-second hold rate, average watch time and profile/link visits. Reuse the strongest hook, not necessarily the post with the most likes. Do not spend on ads until checkout and real audio demos are verified.

## Launch switch

While audio credits or checkout are unavailable, use only items with `phase: pre-launch` and CTA `Follow for the opening.` Once a real vocal, transition and DJ Tool have each been verified, change those items to `ready` and use the launch CTA.
