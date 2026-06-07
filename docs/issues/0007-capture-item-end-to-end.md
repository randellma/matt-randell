# Capture an Item end-to-end

**Type**: HITL
**Status**: ready-for-agent
**Blocked by**: None — can start immediately

## Parent

PRD-0002 — Inventory Declutter Tracker (`docs/prd/0002-inventory-declutter-tracker.md`)

## What to build

The foundational vertical slice: a person can Capture an Item by sending a photo and a name, and it lands as a row in the Inventory Sheet with a private photo and an inline thumbnail.

Stand up the Google substrate this whole context runs on, then the Capture path through it:

- The Inventory **Sheet** with its six author-facing columns and a Disposition dropdown, plus a (possibly hidden) column holding the Drive image URL so a later agent can fetch the photo.
- A **private** Drive folder for photo originals.
- An Apps Script web app, authored in TypeScript and tracked via `clasp`, deployed; the shared secret stored in Script Properties (never in source).
- The **Capture** endpoint: a `POST { secret, name, disposition?, photo, capturedAt }` authenticates the secret, saves the photo privately to Drive, appends a row, and embeds the photo as an inline thumbnail via the Apps Script `CellImage` API. A request with a missing or wrong secret is rejected.

Lifecycle is derived, never stored: an empty Disposition means Captured, a set Disposition with an empty Handled-on means Reviewed, a present Handled-on means Handled. Reviewing (assigning Disposition, adding Notes, marking Handled, filtering) is done directly in the Sheet — this slice just provides the schema that makes that possible.

Sheet schema:

| Column | Filled when |
|---|---|
| Captured at | Capture (timestamp) |
| Photo | Capture (CellImage thumbnail) |
| Name | Capture |
| Disposition | Capture or Review (dropdown: Sell / Give away / Donate; blank = undecided) |
| Handled on | Handled (a date; blank = active) |
| Notes | Review (free text) |
| _Drive image URL_ | Capture (may be hidden) |

Builds the **RequestAuthenticator**, **CapturePayloadMapper**, **DrivePhotoStore**, and **SheetGateway** (append + CellImage) modules. The two pure modules get unit tests; the Drive/Sheet wrappers are verified manually against live Google APIs.

See ADR-0001 (Google stack, CellImage + private Drive) and ADR-0002 (AI is draft-only).

## Acceptance criteria

- [ ] The Inventory Sheet exists with the six author columns, a Disposition dropdown (Sell / Give away / Donate), and a column for the Drive image URL
- [ ] A private Drive folder holds photo originals; the originals are not publicly accessible
- [ ] The Apps Script source is authored in TypeScript and tracked via `clasp` under the Inventory context; the shared secret lives in Script Properties, not in git
- [ ] A `POST` with the correct secret, a name, and a photo appends a row and embeds an inline CellImage thumbnail
- [ ] An optional Disposition supplied at Capture is recorded; when omitted, the Disposition cell is left blank
- [ ] A `POST` with a missing or wrong secret is rejected and writes nothing
- [ ] Unit tests cover RequestAuthenticator (accepts correct secret; rejects missing/empty/wrong) and CapturePayloadMapper (full payload → ordered row values; missing Disposition left blank; timestamp and image reference carried through)
- [ ] Verified manually: a curl Capture lands a row with a visible thumbnail and a private Drive original
