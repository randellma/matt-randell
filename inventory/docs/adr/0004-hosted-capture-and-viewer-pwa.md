# Capture and viewing move to a hosted PWA; the backend stays Apps Script

---
Status: accepted (amends ADR-0001's "no hosting" stance)
---

Capture and a read-only viewer move from "an iOS Shortcut + the raw Sheet" to an installable Progressive Web App served at `inventory.mattrandell.com`. This amends [ADR-0001](0001-google-stack-not-gcp.md), which concluded *"the Sheet doubles as the viewer, so no hosting is needed at all."* That stood while capture was a Shortcut, but the Shortcut had to be hand-edited and re-shared to every phone for any change — the friction this decision removes. **ADR-0001's other half stands unchanged:** the backend is still Apps Script + the Sheet + private Drive, with no server to maintain. Only the *client* changes.

## What the PWA is — and isn't

- **In scope:** Capture (camera + name + optional Disposition → the existing Capture endpoint) and a **read-only** viewer of Items.
- **Out of scope (deliberately):** Review stays in the Sheet — the Sheet is still the Review surface per [CONTEXT.md](../../CONTEXT.md). The PWA does not write Dispositions, notes, or Handled dates.
- **Online-only, installable.** Capture requires connectivity, exactly as the Shortcut did today; an offline capture queue was rejected as unearned complexity for a tool used while walking around the house. The PWA is installable (home-screen icon, full-screen shell) so it *feels* like the Shortcut it replaces.

## Considered options

- **A thin hosted backend in front of Apps Script** (e.g. Cloud Run), to give clean CORS, server-held secrets, and a storage-swap seam — *rejected for now.* CORS alone is solved for free by sending POSTs as `Content-Type: text/plain` (dodging the preflight Apps Script can't answer) — verified with a browser spike against the live endpoint. The storage-swap seam is preserved instead as a **code-level `InventoryStore` interface** in the PWA (an `AppsScriptStore` today, swappable later) — the decoupling without an always-on service to babysit. A real backend is deferred until there's a concrete trigger: moving Review into the PWA, or actually picking a non-Google store. That would reopen ADR-0001's backend half and get its own ADR.
- **Second GitHub Pages repo for the subdomain** — *rejected:* GitHub Pages allows one custom domain per repo and the apex (`mattrandell.com`) already uses this monorepo's Pages, so a subdomain there forces a second repo, breaking the monorepo preference.
- **A path on the existing site (`mattrandell.com/inventory`)** — *rejected:* zero new infra, but it shares an origin with the public marketing site, so the `localStorage`-held secret would be readable by any script on that origin. A separate subdomain origin isolates it.
- **A real identity gate (Google sign-in / Cloudflare Access)** — *rejected as overkill:* the threat model is modest (worst case of a leaked secret is junk rows in a declutter sheet; photos stay private in Drive regardless). Auth reuses the existing shared secret, entered once per device and kept in `localStorage`.

## Decisions of record

- **Host:** the static PWA on **Cloudflare Pages**, keeping the monorepo intact. This follows from [ADR-0003](../../../docs/adr/0003-dns-on-cloudflare-not-cloud-dns.md): with Cloudflare now the DNS authority, DNS + hosting + Terraform all sit with one mature provider, and origin isolation still holds. Infra (the Pages project + its custom-domain binding) is Terraform-managed via the `cloudflare` provider; `inventory.mattrandell.com` is a Cloudflare DNS record; file deploys run from a GitHub Actions workflow (Cloudflare Pages / `wrangler`), mirroring the main site's Terraform-for-infra / Actions-for-artifacts split. (Firebase Hosting + Cloud DNS was the earlier pick, made while Cloud DNS was assumed authoritative; dropped once DNS consolidated on Cloudflare.)
- **Photos stay private.** The viewer never exposes a publicly fetchable photo URL — ADR-0001's hard line holds. Thumbnails are streamed as base64 through a new **authenticated "all Items" GET** (the only GET today returns pending Sell Items only). Apps Script remains the sole gatekeeper of Drive.
- **Auth:** the existing shared secret, entered once per device into `localStorage`, attached to every request. POSTs carry it in the body; GETs in the query string (an accepted downgrade — it can land in history/logs). Rotating it means changing Script Properties and re-entering on each device.
- **CORS:** browser→Apps Script directly, POSTs as `text/plain` to avoid the preflight, GETs with the secret as a query param. No backend change — `WebApp.ts` already `JSON.parse`s the raw body. Future deploys must **update the existing Apps Script deployment** (stable URL) rather than mint a new one, or the PWA's hardcoded endpoint silently breaks.

## Consequence

This activates the previously-dormant **Inventory → Infrastructure** relationship in [CONTEXT-MAP.md](../../../CONTEXT-MAP.md): Inventory now depends on Terraform-managed Cloudflare DNS and Cloudflare Pages for the first time. The iOS Shortcut can be retired once the PWA is in use on both phones; the unchanged endpoint means both can coexist during the transition.
