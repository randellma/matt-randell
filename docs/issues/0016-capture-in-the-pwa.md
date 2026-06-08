# Capture in the PWA

**Type**: HITL
**Status**: ready-for-human
**Blocked by**: #0015 — Cloudflare Pages shell at inventory.mattrandell.com

## Parent

PRD-0002 — Inventory Declutter Tracker (`docs/prd/0002-inventory-declutter-tracker.md`)

## What to build

Replace the iOS Shortcut with in-PWA Capture. A one-time **secret gate**: the shared secret is entered once per device, stored in `localStorage`, and attached to every request (no secret is baked into the shipped JS). A capture screen: take or pick a photo, type a name, optionally choose a Disposition (Sell / Give away / Donate / **Junk**). It POSTs as `Content-Type: text/plain` (to dodge the CORS preflight Apps Script can't answer) through an **`InventoryStore`** interface with an `AppsScriptStore` implementation, to the existing Capture endpoint — landing a row with an inline thumbnail in the Sheet. The `InventoryStore` seam keeps storage swappable later without standing up a backend (ADR-0004).

Use the **current** `/exec` deployment URL, and going forward always update the *existing* Apps Script deployment (stable URL) rather than minting a new one, so the PWA's endpoint never silently breaks. Rotate the shared secret as part of standing this up (it was exposed during the CORS spike) and re-enter it on each device. Retire the iOS Shortcut on both phones once PWA capture is confirmed working.

## Acceptance criteria

- [ ] First load prompts for the shared secret once; it is stored in `localStorage` and sent on every request; no secret is present in the shipped JS
- [ ] Capture screen offers photo + name + optional Disposition (Sell / Give away / Donate / Junk)
- [ ] Capturing from a phone lands an Item in the Sheet with a thumbnail; a chosen Disposition is recorded, skipping leaves it blank
- [ ] Requests go through an `InventoryStore` → `AppsScriptStore` abstraction (storage swappable without touching the UI)
- [ ] POSTs use `text/plain` and the current `/exec` URL, and work cross-origin from `inventory.mattrandell.com`
- [ ] The shared secret is rotated; the iOS Shortcut is retired on both phones once PWA capture is confirmed working

## Blocked by

- #0015 — needs the deployed, installable PWA shell
