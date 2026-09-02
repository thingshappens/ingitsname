# HSC marketing chain

This folder is the source of truth for organic marketing. It keeps one idea, one caption and one call-to-action reusable across Instagram Reels, TikTok and YouTube Shorts.

## What is automated now

Run `npm run marketing:brief` to produce the next ready-to-record content brief. It selects from `content-queue.json` and gives the exact hook, frames, caption, hashtags and CTA.

## What remains intentionally disconnected

No social account is connected and nothing is published automatically. Publishing, ads and direct messages need explicit account access and a separate approval step.

## Launch switch

While audio credits or checkout are unavailable, use only items with `phase: pre-launch` and CTA `Follow for the opening.` Once a real vocal, transition and DJ Tool have each been verified, change those items to `ready` and use the launch CTA.
