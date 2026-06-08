# The Claude listing routine

**Type**: HITL
**Status**: closed
**Blocked by**: #0009 — Pending Sell Items endpoint; #0010 — Write Listing draft endpoint

## Parent

PRD-0002 — Inventory Declutter Tracker (`docs/prd/0002-inventory-declutter-tracker.md`)

## What to build

The drafting brain: a Claude routine running on the owner's subscription that generates a Listing draft for every Sell Item that lacks one. Once a day (and on demand) it asks the "Pending Sell Items" endpoint for the work queue, looks at each Item's photo, generates a suggested price range, a one-line rationale, and a copy-paste-ready post template, and POSTs each draft back via the "Write Listing draft" endpoint. Apps Script remains the single gatekeeper of the Sheet and Drive; the routine only speaks to its endpoints.

Pricing starts as an **LLM estimate only** — a range plus a rationale the human can override — not live market-comp research. All output is a draft: nothing posts to, messages on, or commits anything on Facebook (ADR-0002). See ADR-0003 for why this is a subscription routine rather than Apps Script calling the Claude API, and for the named fallback if the routine can't reach the endpoints reliably.

_HITL: the routine lives in the owner's Claude subscription (schedule, prompt, on-demand trigger), and pricing quality needs a human spot-check._

## Acceptance criteria

- [x] A Claude routine runs on the owner's subscription on a daily schedule and can also be triggered on demand
- [x] Each run pulls pending Sell Items, looks at each photo, and writes back a price range, a one-line rationale, and a post template
- [x] Pricing is an LLM estimate (range + rationale); no web-search comps and no autonomous Facebook interaction
- [x] Items captured during the day have Listing drafts by the next morning's run
- [x] Verified manually: a run clears the backlog of un-drafted Sell Items, and a spot-check of a few generated prices is sane

## Blocked by

- #0009 — needs the pending-items read endpoint
- #0010 — needs the draft-write endpoint
