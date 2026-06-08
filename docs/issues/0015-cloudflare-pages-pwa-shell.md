# Cloudflare Pages shell at inventory.mattrandell.com

**Type**: HITL
**Status**: ready-for-human
**Blocked by**: #0012 — Onboard existing Cloudflare infra into Terraform

## Parent

PRD-0002 — Inventory Declutter Tracker (`docs/prd/0002-inventory-declutter-tracker.md`)

## What to build

The walking skeleton for the hosted PWA — proving hosting, DNS, deploy, and installability end-to-end before any feature logic. A Terraform-managed Cloudflare Pages project plus a Cloudflare DNS record for `inventory.mattrandell.com`, deployed by a GitHub Actions workflow (mirroring the main site's Terraform-for-infra / Actions-for-artifacts split), serving a minimal **installable** PWA shell over HTTPS. No capture or viewer logic yet — just confirm that pushing to `main` deploys a page that is reachable and installable at the subdomain. See ADR-0004 (host on Cloudflare Pages) and ADR-0003 (Cloudflare is the DNS authority).

## Acceptance criteria

- [ ] The Cloudflare Pages project and the `inventory.mattrandell.com` DNS record are managed in Terraform
- [ ] A GitHub Actions workflow builds and deploys the PWA on push to `main`
- [ ] `https://inventory.mattrandell.com` loads the shell over valid HTTPS
- [ ] The app is installable (manifest + icons + service-worker app shell); "Add to Home Screen" on iOS yields a full-screen, chrome-less app
- [ ] The PWA source lives in the monorepo (e.g. `inventory/web/`)

## Blocked by

- #0012 — needs Cloudflare manageable in Terraform to add the Pages project and DNS record
