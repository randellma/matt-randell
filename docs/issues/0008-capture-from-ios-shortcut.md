# Capture from the iOS Shortcut on both phones

**Type**: HITL
**Status**: ready-for-agent
**Blocked by**: #0007 — Capture an Item end-to-end

## Parent

PRD-0002 — Inventory Declutter Tracker (`docs/prd/0002-inventory-declutter-tracker.md`)

## What to build

The real capture UX: an iOS Shortcut that turns Capturing an Item into a couple of taps while standing in front of it. Take or pick a photo, type a name, optionally choose a Disposition if already known, and the Shortcut POSTs to the Capture endpoint with the shared secret. Installed on both Matt's and his wife's phones so either can Capture independently.

This slice adds no new server code — it wires the human capture flow to the endpoint built in #0007.

## Acceptance criteria

- [ ] An iOS Shortcut prompts for a photo and a name, and optionally a Disposition, then POSTs to the Capture endpoint with the shared secret
- [ ] The Shortcut is installed and working on both phones
- [ ] Capturing from either phone lands an Item in the Sheet with a thumbnail
- [ ] Choosing a Disposition in the Shortcut records it on the row; skipping it leaves the Disposition blank
- [ ] The shared secret is held in the Shortcut, not exposed in the Sheet or repo
