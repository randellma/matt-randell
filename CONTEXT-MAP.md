# Context Map

This repo holds more than one domain. Each context has its own glossary.

## Contexts

- [Site & Infrastructure](./CONTEXT.md) — the static website at `mattrandell.com` (GitHub Pages), the GCP resources (Cloud Domains), and the Cloudflare infrastructure (DNS, tunnels) that routes all subdomains — including the Home Server
- [Inventory](./inventory/CONTEXT.md) — capturing household items to declutter and tracking how each one leaves the house

The `wayfair-apps` private repo has its own context:
- [Wayfair Apps](https://github.com/randellma/wayfair-apps) — the Discount App at `discount.mattrandell.com` and its Chrome Extension

## Relationships

- **Inventory → Site & Infrastructure**: Inventory's PWA is hosted at `inventory.mattrandell.com` (Cloudflare Pages, Cloudflare DNS record — both Terraform-managed). See [inventory/docs/adr/0004](./inventory/docs/adr/0004-hosted-capture-and-viewer-pwa.md).
- **Inventory → Home Server**: Inventory's backend is **PocketBase** deployed on the Home Server via Coolify, routed through the same Cloudflare Tunnel as the Discount App. The Google stack (Apps Script, Sheet, Drive) has been replaced. See [inventory/docs/adr/0005](./inventory/docs/adr/0005-pocketbase-on-home-server.md).
- **Wayfair Apps → Site & Infrastructure**: The Discount App runs on the Home Server managed by Coolify. Its public subdomain (`discount.mattrandell.com`) is a Cloudflare DNS record in this repo's Terraform, routed via the single Cloudflare Tunnel to the Home Server's Traefik. See [ADR-0004](./docs/adr/0004-coolify-as-self-hosted-paas.md) and [ADR-0005](./docs/adr/0005-single-tunnel-via-traefik.md).

## System-wide decisions

- `docs/adr/` holds decisions that span contexts (monorepo layout, domain transfer). Context-specific decisions live under that context's own `docs/adr/` when they arise.
