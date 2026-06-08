# "All Items" read endpoint with thumbnails

**Type**: AFK
**Status**: ready-for-agent
**Blocked by**: None — can start immediately

## Parent

PRD-0002 — Inventory Declutter Tracker (`docs/prd/0002-inventory-declutter-tracker.md`)

## What to build

The read API the hosted viewer needs. Today the only `GET` returns the *pending Sell* work queue; the viewer needs **every** Item. Add a new authenticated `GET` that returns all Items, each with its name, derived lifecycle (Captured / Reviewed / Handled), Disposition, notes, captured-at, and handled-on — plus a small **base64 thumbnail** so a browser can display the photo without it ever becoming publicly fetchable. Photo originals stay private in Drive (ADR-0001, ADR-0004); the thumbnail comes from Drive's `getThumbnail` and is served only through this authenticated endpoint, keeping Apps Script the sole gatekeeper. Authenticated by the shared secret like the other endpoints.

Builds a pure all-items selector/mapper (unit-tested) over the sheet rows, reusing the existing lifecycle derivation; the Sheet read and Drive thumbnail fetch are thin glue verified manually against live Google APIs — the same split as issues 0009/0010.

Note: thumbnails are returned inline for now; if the list grows large, lazy/paginated thumbnails are a later optimization.

## Acceptance criteria

- [ ] An authenticated `GET` returns all Items with name, derived lifecycle, Disposition, notes, captured-at, and handled-on
- [ ] Each Item includes a small base64 thumbnail; no publicly-fetchable photo URL is exposed
- [ ] Items of every Disposition (Sell / Give away / Donate / Junk) and every lifecycle state are included — it is the full list, not the pending-Sell queue
- [ ] Unit tests cover the all-items selector/mapper (row → item shape; lifecycle derived correctly)
- [ ] Verified manually: a browser fetch (secret as query param) returns readable JSON with rendering-ready thumbnails

## Blocked by

- None — can start immediately
