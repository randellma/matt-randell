# Inventory — Household Declutter Tracker

**Status**: ready-for-agent

## Problem Statement

My wife and I are decluttering the house and want to sell, give away, or donate things we no longer need. As we walk through rooms we spot items constantly, but there's no fast way to record them — by the time we'd open a spreadsheet and type details we've lost momentum, and a name alone doesn't jog the memory later. We need to capture an item in a couple of taps (a photo and a name) while standing in front of it, then decide its fate later, together, from one place. Separately, the stuff we plan to sell needs pricing and a listing written, which is tedious research we'd rather not do by hand for every item.

## Solution

A near-trivial capture-and-track pipeline built entirely on Google (see ADR-0001):

- **Capture** is an iOS Shortcut on both our phones: take/pick a photo, type a name, optionally pick a Disposition if we already know it. It POSTs to a Google Apps Script web app that saves the photo to a private Drive folder, embeds an inline thumbnail in a Google Sheet, and appends a row.
- **Review** happens directly in the Sheet — it's the review surface. We assign each Captured Item a Disposition (Sell / Give away / Donate) from a dropdown and add notes. The inline thumbnails make reviewing fast.
- **Listing generation** for Sell Items is handled by a Claude routine running on my subscription (see ADR-0003): once a day (and on demand) it pulls Sell Items that lack a Listing draft, looks at each photo, and writes back a suggested price range, a one-line rationale, and a copy-paste-ready post template.

All AI is draft-only — nothing posts to or messages on Facebook automatically (see ADR-0002). We stay the hands and the judgment.

## User Stories

1. As a declutterer walking through the house, I want to capture an Item with just a photo and a name in a couple of taps, so that I can record things without losing momentum.
2. As a declutterer, I want to trigger Capture from an iOS Shortcut on my phone, so that recording an Item is as fast as taking a photo.
3. As a declutterer who already knows an Item's fate, I want to optionally set its Disposition at Capture time, so that obvious cases (junk to donate) skip the Review step.
4. As a declutterer, I want Capture to work the same on both my and my wife's phones, so that either of us can record Items independently.
5. As a declutterer, I want each captured photo stored privately, so that photos of the inside of our house are never publicly accessible.
6. As a reviewer, I want every Item to appear as a row in one Google Sheet, so that we have a single shared place to work through our stuff.
7. As a reviewer, I want to see an inline thumbnail of each Item in the Sheet, so that I can recognise it at a glance without opening links.
8. As a reviewer, I want to assign a Disposition from a dropdown (Sell / Give away / Donate), so that we decide together how each Item leaves the house.
9. As a reviewer, I want to add free-text notes to an Item, so that I can record context (who it's promised to, condition, where it is).
10. As a reviewer, I want to filter the Sheet to Items with no Disposition yet, so that I have a clear Review queue.
11. As a reviewer, I want to filter the Sheet to Items that haven't been Handled, so that I can see what's still active.
12. As a reviewer, I want an Item's lifecycle state (Captured / Reviewed / Handled) to follow from the data I've already entered, so that I never maintain a separate status field that drifts out of sync.
13. As a reviewer, I want to mark an Item Handled by recording the date it left, so that completed Items drop off the active list.
14. As a seller, I want a Listing draft generated for each Sell Item, so that I don't face a blank page when posting to Marketplace.
15. As a seller, I want the Listing draft to include a copy-paste-ready title and description, so that posting is mostly paste-and-go.
16. As a seller, I want a suggested price range with a one-line rationale, so that I have a sane starting number without doing the research myself.
17. As a seller, I want the price suggestion derived from the actual photo and name of the Item, so that it reflects what the thing actually is.
18. As a seller, I want Listing drafts generated automatically once a day, so that Items I capture get priced by the next morning without me asking.
19. As a seller, I want to kick the listing routine off on demand, so that I can get a draft immediately when I want one.
20. As a seller, I want to override any suggested price, so that my judgement always wins over the estimate.
21. As a seller distinguishing free handoffs, I want "Give away" tracked separately from "Donate", so that I know which Items go to the Buy Nothing group versus the thrift shop.
22. As an owner concerned about cost, I want listing generation to run on my existing Claude subscription, so that there's no per-use API billing or separate key to manage.
23. As an owner concerned about my Facebook account, I want all AI to stay draft-only, so that nothing automated risks an account ban by posting or messaging on its own.
24. As an owner, I want the one piece of real code (the Apps Script) tracked in the repo via clasp, so that it has history and a backup rather than living only in Google's editor.
25. As an owner, I want the shared secret kept out of git, so that committing the source never leaks the endpoint's credential.
26. As an owner, I want the endpoint to reject requests without the correct shared secret, so that randoms can't POST junk into our Sheet.

## Implementation Decisions

### Architecture (see ADR-0001)

Inventory runs entirely on the Google stack — Google Apps Script (web app), a Google Sheet (store + review surface), and a private Google Drive folder (photo originals). No GCP, no server to maintain, no hosted viewer. The Apps Script source is authored in TypeScript and tracked via `clasp` so the pure domain logic is unit-testable under node and the Apps Script API calls stay as thin shells.

### Modules

**Pure domain logic (deep, testable in isolation):**

- **RequestAuthenticator** — validates the shared secret on every incoming request; returns accept/reject. The secret is read from Apps Script Script Properties at runtime, never present in source.
- **CapturePayloadMapper** — maps a capture payload (name, optional Disposition, capture timestamp, Drive image reference) to the ordered set of row values appended to the Sheet.
- **LifecycleDeriver** — given a row, derives the lifecycle state: `Disposition` empty ⇒ Captured; `Disposition` set and `Handled on` empty ⇒ Reviewed; `Handled on` present ⇒ Handled. The single source of lifecycle truth.
- **PendingDraftSelector** — given all rows, returns the Sell Items that lack a Listing draft. This is the work queue the routine consumes.
- **ListingDraftMapper** — maps an agent-produced Listing draft (price range, rationale, post template) to the cell writes for that Item's row.

**Google glue (thin wrappers, verified manually):**

- **DrivePhotoStore** — saves photo bytes to the private Drive folder; returns the file ID and URL.
- **SheetGateway** — appends a row, embeds the inline thumbnail via the Apps Script `CellImage` API, and writes a Listing draft back to a row.
- **WebApp** (`doPost`/`doGet` router) — wires HTTP requests to the modules above.

**Out-of-repo configuration:**

- The **iOS Shortcut** (capture UX on both phones), holding the endpoint URL and shared secret.
- The **Listing routine** — a Claude routine (prompt + daily schedule) that calls the endpoints and performs the vision-based pricing.

### Photo handling (see ADR-0001)

Inline thumbnails are embedded with the Apps Script `CellImage` API, not `=IMAGE(driveUrl)` — the `=IMAGE()` path is being broken by Google and requires the photo be publicly fetchable. `CellImage` embeds reliably while Drive originals stay private. Each row also stores the Drive image URL/file-ID (alongside the thumbnail) so the listing routine can fetch the actual photo to price it.

### Sheet schema

The Sheet has six author-facing columns; lifecycle is derived, not stored. Sell-specific Listing-draft columns are written by the routine.

| Column | Filled when | By |
|---|---|---|
| Captured at | Capture | Shortcut (timestamp) |
| Photo | Capture | Apps Script (CellImage thumbnail) |
| Name | Capture | the person capturing |
| Disposition | Capture or Review | dropdown: Sell / Give away / Donate; blank = undecided |
| Handled on | Handled | a date; blank = still active |
| Notes | Review | free text |
| _(Drive image URL)_ | Capture | Apps Script; may be hidden — lets the routine see the photo |
| _(Listing draft fields: price range, rationale, post template)_ | Listing generation | the Claude routine, for Sell Items |

### API contracts (Apps Script web app)

- **Capture** — `POST` with `{ secret, name, disposition?, photo, capturedAt }`. Authenticated by RequestAuthenticator; saves the photo via DrivePhotoStore; appends the row via SheetGateway (CapturePayloadMapper builds the values).
- **Pending Sell Items** — `GET` returning Sell Items lacking a Listing draft, each with its name and Drive image URL (PendingDraftSelector over the sheet rows).
- **Write Listing draft** — `POST` with `{ secret, itemRef, priceRange, rationale, postTemplate }`; ListingDraftMapper produces the cell writes, SheetGateway applies them.

### Listing routine (see ADR-0003)

A Claude routine on the owner's subscription runs once daily (and on demand) — `GET` pending Sell Items, look at each photo, generate a price range + one-line rationale + post template, `POST` each draft back. Pricing starts as an **LLM estimate only** (range + rationale the human can override), not live market-comp research. Apps Script remains the single gatekeeper of the Sheet and Drive; the routine only speaks to its endpoints. ADR-0003 names the fallback (Apps Script calling the Claude API directly) if the routine proves too fiddly to read/write the Sheet reliably.

### AI boundary (see ADR-0002)

All AI is draft-only and human-in-the-loop. Nothing automated logs into Facebook, posts a listing, messages a buyer, or commits to a price or pickup. This is a deliberate, permanent boundary — there is no personal Marketplace/Messenger API, the owner's real account is the one at risk, and autonomous negotiation with strangers is a liability.

## Testing Decisions

A good test here asserts external behaviour through a module's interface — given inputs, the right outputs — not internal implementation. The pure domain modules are deterministic and have no Google dependency, so they are the unit-test surface; the Google glue is thin and only meaningfully exercised against live Google APIs (verified manually), and the routine's pricing is LLM behaviour (spot-checked on a handful of real Items, not asserted).

Unit tests will be written for the five pure modules:

- **RequestAuthenticator** — accepts a request carrying the correct secret; rejects a missing, empty, or wrong secret.
- **CapturePayloadMapper** — maps a full payload to the correct ordered row values; handles a payload with no Disposition (leaves it blank); carries the timestamp and image reference through.
- **LifecycleDeriver** — returns Captured for an empty Disposition, Reviewed for a set Disposition with no Handled-on, Handled when Handled-on is present.
- **PendingDraftSelector** — returns only Sell Items missing a Listing draft; excludes Give away / Donate Items, Sell Items already drafted, and undecided Items.
- **ListingDraftMapper** — maps a draft to the correct cells for the target Item's row.

Tests run under node against the TypeScript sources (the same sources `clasp` pushes to Apps Script), so they need no Google project. There is no prior art for unit tests in this repo — PRD-0001 (the site/infrastructure setup) intentionally had none — so these establish the pattern: pure logic isolated from side-effecting Google calls, asserted through public interfaces.

Manual verification covers the rest: deploy the web app and confirm a Capture from the Shortcut lands a row with a visible thumbnail and a private Drive original; confirm the routine reads pending Sell Items and writes back a sensible draft; spot-check a few generated prices for sanity.

## Out of Scope

- A hosted viewer under `inventory.mattrandell.com` — the Sheet is the viewer for now; no DNS/Infrastructure work happens for Inventory.
- The Chrome-extension reply helper (a button that drafts Messenger replies from the visible thread) — Phase 2.
- A negotiation price **floor** column and any negotiation/haggling data — deferred with the reply helper.
- Web-search market comps for pricing — pricing starts as an LLM estimate; a deeper, manual per-item research run is a later add only if estimates feel off.
- Any autonomous Facebook interaction — posting, messaging, or committing to sales is permanently out of scope per ADR-0002, not merely deferred.
- "Captured by" attribution and room/location columns — easy to add to the Sheet later if wanted; not built now.
- Multi-household or multi-user beyond the two phones; auth beyond the single shared secret.

## Further Notes

- The natural build order: (1) the Sheet (six columns + Disposition dropdown) and the private Drive folder; (2) the Apps Script (`clasp` init, Capture endpoint, secret in Script Properties, CellImage embed); (3) the iOS Shortcut on both phones; (4) the agent-facing endpoints and the daily Claude routine.
- Two things to verify during the build rather than decide now: whether the daily routine can reliably reach the Apps Script endpoints and do vision on the Drive images from within the subscription's scheduling (ADR-0003's fallback exists for if it can't), and that `CellImage` embeds at the thumbnail size that makes Review fast.
- Glossary and decisions: see [inventory/CONTEXT.md](../../inventory/CONTEXT.md) and ADRs 0001–0003 under `inventory/docs/adr/`.
