# Replace the Google stack with PocketBase on the Home Server

---
Status: accepted (supersedes ADR-0001's backend half and amends ADR-0004's scope)
---

The Apps Script backend is replaced by **PocketBase** deployed on the Home Server via Coolify. This decision is driven by two things arriving together: unacceptable response times from Apps Script, and Review moving into the PWA (making the Sheet no longer the review surface).

## Why Apps Script has to go

Response times are unacceptably slow even for the item list with no thumbnails. The root cause is Apps Script's cold-start overhead hitting every request — not thumbnail fetching specifically. (The viewer already does two-phase loading: list first, thumbnails second. The list-only fetch is still too slow.) There is no way to fix cold-start within Apps Script.

## Why PocketBase on the Home Server

**PocketBase** is a single binary (deployed as a Docker container) that bundles SQLite, file storage, and a REST API. It requires no backend code to write, backs up as a single file, and runs cheaply on a home server.

**Home Server via Coolify** is the natural target: the infrastructure already exists (Cloudflare Tunnel → Traefik → Coolify), the pattern is established (the Discount App lives there), and the availability tradeoff is already accepted for household tooling.

Rejected alternatives:

- **GCP serverless (Cloud Run + Firestore + GCS)**: free tier exists, but adds auth complexity and a cold-start (shorter than Apps Script but not zero). Home Server is free and simpler given existing infrastructure.
- **Optimising Apps Script**: the cold-start is structural, not fixable by code changes.

## Decisions of record

- **Auth**: PocketBase collection access rules check `@request.query.secret` against the shared secret. The PWA continues to store the secret in `localStorage` and attach it as a query param. No login screen, no tokens, no UX change.
- **Images**: stored in PocketBase's built-in local file storage. Photos of household items are not precious; Home Server availability risk (and therefore image availability risk) is accepted.
- **Migration**: none. The ~10 existing items in the Sheet are abandoned; the Sheet remains as a read-only archive. Re-capture anything still relevant.
- **Review in the PWA**: the PWA modal gains a notes field. Disposition and Mark Handled already exist. Review no longer happens in the Sheet. This amends [ADR-0004](0004-hosted-capture-and-viewer-pwa.md), which scoped Review out of the PWA.
- **`InventoryStore` interface**: the existing abstraction in `web/src/InventoryStore.ts` is preserved. `AppsScriptStore` is replaced by a `PocketBaseStore` implementation; the rest of the PWA is unchanged.

## What changes after migration

- The **Listing draft routine** (see [ADR-0003](0003-pricing-via-claude-routine.md)) currently polls the Apps Script endpoint for pending Sell Items and POSTs drafts back. It will be updated to hit PocketBase's REST API instead (filter query + record PATCH). This is a separate step after the backend is live.
- The `apps-script/` directory and the Google Sheet become dead weight once the migration is complete.
