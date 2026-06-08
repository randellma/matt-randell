# Read-only viewer in the PWA

**Type**: AFK
**Status**: ready-for-agent
**Blocked by**: #0014 — "All Items" read endpoint; #0016 — Capture in the PWA

## Parent

PRD-0002 — Inventory Declutter Tracker (`docs/prd/0002-inventory-declutter-tracker.md`)

## What to build

A friendlier read-only view of the inventory in the PWA, replacing squinting at the Sheet. Using the same `InventoryStore` (and reusing the secret gate from Capture, #0016), fetch the "All Items" endpoint (#0014) and render the list: thumbnail, name, lifecycle (Captured / Reviewed / Handled), Disposition, and notes. This is **read-only** — Review stays in the Sheet (ADR-0004); the viewer does not edit Disposition, notes, or Handled state.

## Acceptance criteria

- [ ] The PWA fetches all Items via the `InventoryStore` and renders each with thumbnail, name, lifecycle, Disposition, and notes
- [ ] Photos render from base64 thumbnails; nothing publicly fetchable is exposed
- [ ] The view is strictly read-only (no writes to Disposition, notes, or Handled state)
- [ ] Reuses the secret gate and `InventoryStore` from #0016 rather than duplicating them
- [ ] Verified: the rendered list reflects current Sheet data when loaded

## Blocked by

- #0014 — needs the all-items read endpoint
- #0016 — reuses the secret gate and `InventoryStore`
