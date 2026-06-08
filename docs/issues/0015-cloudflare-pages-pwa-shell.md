# Cloudflare Pages shell at inventory.mattrandell.com

**Type**: HITL
**Status**: closed
**Blocked by**: ~~#0012 — Onboard existing Cloudflare infra into Terraform~~ (done)

## Parent

PRD-0002 — Inventory Declutter Tracker (`docs/prd/0002-inventory-declutter-tracker.md`)

## What to build

The walking skeleton for the hosted PWA — proving hosting, DNS, deploy, and installability end-to-end before any feature logic. A Terraform-managed Cloudflare Pages project plus a Cloudflare DNS record for `inventory.mattrandell.com`, deployed by a GitHub Actions workflow (mirroring the main site's Terraform-for-infra / Actions-for-artifacts split), serving a minimal **installable** PWA shell over HTTPS. No capture or viewer logic yet — just confirm that pushing to `main` deploys a page that is reachable and installable at the subdomain. See ADR-0004 (host on Cloudflare Pages) and ADR-0003 (Cloudflare is the DNS authority).

## Acceptance criteria

- [x] The Cloudflare Pages project and the `inventory.mattrandell.com` DNS record are managed in Terraform
- [x] A GitHub Actions workflow builds and deploys the PWA on push to `main`
- [x] `https://inventory.mattrandell.com` loads the shell over valid HTTPS
- [x] The app is installable (manifest + icons + service-worker app shell); "Add to Home Screen" on iOS yields a full-screen, chrome-less app
- [x] The PWA source lives in the monorepo (e.g. `inventory/web/`)

## What was done (AFK)

- `inventory/web/` created with:
  - `index.html` — PWA shell with apple-mobile-web-app meta tags, manifest link, and SW registration
  - `manifest.json` — display: standalone, theme blue, 192 + 512 icons
  - `sw.js` — app-shell cache strategy; caches the shell files on install
  - `icons/icon-192.png` and `icons/icon-512.png` — blue placeholder icons
- `terraform/cloudflare_pages.tf` — `cloudflare_pages_project.inventory`, `cloudflare_pages_domain.inventory`, `cloudflare_dns_record.inventory` (CNAME proxied → `inventory-mattrandell.pages.dev`)
- `.github/workflows/deploy-inventory-pwa.yml` — triggers on push to `main` when `inventory/web/**` changes; deploys via `cloudflare/pages-action@v1`

## HITL runbook

### 1. Mint a scoped Cloudflare API token for CI

Cloudflare dash → My Profile → API Tokens → Create Token → Custom token:

| Scope | Resource | Permission |
|-------|----------|------------|
| Account | Cloudflare Pages | Edit |

- **Account Resources**: Include → your account (Randellma@gmail.com)

Add it to the GitHub repo as Actions secret `CLOUDFLARE_PAGES_API_TOKEN` (Settings → Secrets and variables → Actions).

### 2. Apply Terraform

```sh
cd terraform
terraform plan   # review: should add 3 resources (pages_project, pages_domain, dns_record)
terraform apply
```

> Note: `cloudflare_pages_domain` verifies TLS automatically since DNS is already on Cloudflare. If plan shows an unexpected conflict with the DNS record (Pages auto-creating a CNAME), remove the `cloudflare_dns_record.inventory` block from `cloudflare_pages.tf` and re-plan.

### 3. Trigger the first deploy

Push any change to `inventory/web/**` on `main` (or trigger the workflow manually from the Actions tab). The `deploy-inventory-pwa.yml` workflow deploys `inventory/web/` to the `inventory-mattrandell` Pages project.

Confirm the workflow succeeds in the GitHub Actions UI.

### 4. Verify HTTPS and installability

- Visit `https://inventory.mattrandell.com` — should load the "Inventory / Coming soon" shell.
- On iOS Safari: Share → "Add to Home Screen" → launch from the home screen. The app should open full-screen with no browser chrome.

### Acceptance gate

All four acceptance criteria checked above.
