# "Write Listing draft" endpoint

**Type**: AFK
**Status**: ready-for-agent
**Blocked by**: #0007 — Capture an Item end-to-end

## Parent

PRD-0002 — Inventory Declutter Tracker (`docs/prd/0002-inventory-declutter-tracker.md`)

## What to build

The write half of the agent-facing API: a `POST` endpoint that records a Listing draft against a Sell Item — a suggested price range, a one-line rationale, and a copy-paste-ready post template — written back into that Item's row.

Builds the **ListingDraftMapper** (draft → the cell writes for the target row) module and the draft-write path of **SheetGateway**, with unit tests for the mapper. The endpoint authenticates with the shared secret.

Verifiable on its own by curling a draft for a known Item and confirming the cells update. Independent of #0009 — one reads, this one writes.

## Acceptance criteria

- [ ] A `POST` (authenticated by the shared secret) accepts an Item reference plus a price range, rationale, and post template, and writes them to that Item's row
- [ ] Writing a draft does not disturb the author-facing columns (Name, Disposition, Notes, Handled on)
- [ ] Unit tests cover ListingDraftMapper (draft → correct cell writes for the target Item)
- [ ] Verified manually: a curl draft-write updates the intended row's Listing-draft cells

## Blocked by

- #0007 — needs the Sheet and deployed web app
