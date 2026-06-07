# "Pending Sell Items" endpoint

**Type**: AFK
**Status**: done
**Blocked by**: #0007 — Capture an Item end-to-end

## Parent

PRD-0002 — Inventory Declutter Tracker (`docs/prd/0002-inventory-declutter-tracker.md`)

## What to build

The read half of the agent-facing API: a `GET` endpoint that returns the work queue for listing generation — the Sell Items that do not yet have a Listing draft, each with its name and Drive image URL so the routine can see the photo to price it.

Builds the **PendingDraftSelector** (filters all rows to Sell Items missing a Listing draft) and **LifecycleDeriver** (row → Captured / Reviewed / Handled) modules with unit tests. The endpoint authenticates with the shared secret like the Capture endpoint.

This is verifiable on its own by marking some rows Sell in the Sheet and curling the endpoint.

## Acceptance criteria

- [x] A `GET` (authenticated by the shared secret) returns Sell Items that have no Listing draft, each with name and Drive image URL
- [x] Give away and Donate Items, undecided Items, and Sell Items already drafted are excluded from the result
- [x] Unit tests cover LifecycleDeriver (empty Disposition → Captured; set Disposition, empty Handled-on → Reviewed; present Handled-on → Handled)
- [x] Unit tests cover PendingDraftSelector (returns only un-drafted Sell Items; excludes other Dispositions, undecided, and already-drafted Items)
- [ ] Verified manually: after marking rows Sell, the endpoint returns exactly those Items lacking a draft

## Blocked by

- #0007 — needs the Sheet and deployed web app
