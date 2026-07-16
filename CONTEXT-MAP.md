# Context Map

This repo holds more than one domain. Each context has its own glossary.

## Contexts

- [Site & Infrastructure](./CONTEXT.md) — the static website at `mattrandell.com` (GitHub Pages), the GCP resources (Cloud Domains), and the Cloudflare infrastructure (DNS, tunnels) that routes all subdomains — including the Home Server
- [Inventory](./inventory/CONTEXT.md) — capturing household items to declutter and tracking how each one leaves the house
Two private repos have their own contexts:
- [Slate](https://github.com/randellma/heyslate) — splitting shared expenses among friends and family with zero sign-up friction, including receipt-scan itemized splits (formerly "Divvy"; moved out of this repo 2026-07)
- [Wayfair Apps](https://github.com/randellma/wayfair-apps) — the Discount App at `discount.mattrandell.com` and its Chrome Extension

## Relationships

- **Inventory → Site & Infrastructure**: Inventory's PWA is hosted at `inventory.mattrandell.com` (Cloudflare Pages, Cloudflare DNS record — both Terraform-managed). See [inventory/docs/adr/0004](./inventory/docs/adr/0004-hosted-capture-and-viewer-pwa.md).
- **Inventory → Home Server**: Inventory's backend is **PocketBase** deployed on the Home Server via Coolify, routed through the same Cloudflare Tunnel as the Discount App. The Google stack (Apps Script, Sheet, Drive) has been replaced. See [inventory/docs/adr/0005](./inventory/docs/adr/0005-pocketbase-on-home-server.md).
- **Slate → Site & Infrastructure / Home Server**: Slate lives in the private [heyslate repo](https://github.com/randellma/heyslate) (code, and Terraform for the `heyslate.app` zone + Pages project), but its backend (`api.heyslate.app`, PocketBase via Coolify) rides this repo's single Cloudflare Tunnel, and this repo keeps the legacy shims in the `mattrandell.com` zone: `divvy.mattrandell.com` 301s to heyslate.app; `slate.mattrandell.com` still serves the shell so it can hand off localStorage group tokens client-side (only `/g/*` + `/og/*` are edge-redirected); `divvy-api.mattrandell.com` keeps answering so installed PWAs don't break (`terraform/cloudflare.tf`, `terraform/cloudflare_pages.tf`, `terraform/homeserver.tf`).
- **Wayfair Apps → Site & Infrastructure**: The Discount App runs on the Home Server managed by Coolify. Its public subdomain (`discount.mattrandell.com`) is a Cloudflare DNS record in this repo's Terraform, routed via the single Cloudflare Tunnel to the Home Server's Traefik. See [ADR-0004](./docs/adr/0004-coolify-as-self-hosted-paas.md) and [ADR-0005](./docs/adr/0005-single-tunnel-via-traefik.md).

## System-wide decisions

- `docs/adr/` holds decisions that span contexts (monorepo layout, domain transfer). Context-specific decisions live under that context's own `docs/adr/` when they arise.
