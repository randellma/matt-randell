# Capture from the iOS Shortcut on both phones

**Type**: HITL
**Status**: done
**Blocked by**: #0007 — Capture an Item end-to-end

## Parent

PRD-0002 — Inventory Declutter Tracker (`docs/prd/0002-inventory-declutter-tracker.md`)

## What to build

The real capture UX: an iOS Shortcut that turns Capturing an Item into a couple of taps while standing in front of it. Take or pick a photo, type a name, optionally choose a Disposition if already known, and the Shortcut POSTs to the Capture endpoint with the shared secret. Installed on both Matt's and his wife's phones so either can Capture independently.

This slice adds no new server code — it wires the human capture flow to the endpoint built in #0007.

## Acceptance criteria

- [x] An iOS Shortcut prompts for a photo and a name, and optionally a Disposition, then POSTs to the Capture endpoint with the shared secret
- [x] The Shortcut is installed and working on both phones
- [x] Capturing from either phone lands an Item in the Sheet with a thumbnail
- [x] Choosing a Disposition in the Shortcut records it on the row; skipping it leaves the Disposition blank
- [x] The shared secret is held in the Shortcut, not exposed in the Sheet or repo

## Agent output

Shortcut file built at `inventory/CaptureItem.shortcut` (29 actions, XML plist).

Flow: Take/pick photo → name prompt → Disposition menu (Sell / Give away / Donate / Skip) → ISO 8601 timestamp → JPEG→base64 → POST JSON to Capture endpoint → show response.

The `secret` field in the Dictionary action is pre-filled with the placeholder `REPLACE_WITH_YOUR_SECRET` — replace it with the real value on each phone after installing.

## Human steps required

1. **Get the Shortcut onto each phone.** Options:
   - AirDrop `inventory/CaptureItem.shortcut` from your Mac to each phone, then tap to install.
   - Or: share via iCloud Drive / Messages, tap to open in Shortcuts.

2. **Replace the secret.** After installing, open the Shortcut in the Shortcuts app → find the Dictionary action → change `REPLACE_WITH_YOUR_SECRET` to the real `SECRET` value from Apps Script Script Properties.

3. **Run a test capture** from each phone — point at something, type a name, pick a Disposition. Confirm a new row appears in the [Inventory Sheet](https://docs.google.com/spreadsheets/d/1qRucz2hpcnxl0gpUkQ8f6VIdtazRbTsUK8RlnWwDsdA/edit) with a thumbnail.

4. Mark remaining acceptance criteria above once verified.
