# Context Map

This repo holds more than one domain. Each context has its own glossary.

## Contexts

- [Site & Infrastructure](./CONTEXT.md) — the static website at `mattrandell.com` (GitHub Pages) and the GCP resources (Cloud Domains, Cloud DNS) that route to it
- [Inventory](./inventory/CONTEXT.md) — capturing household items to declutter and tracking how each one leaves the house

## Relationships

- **Inventory → Site & Infrastructure**: Inventory's store still lives entirely in Google (Apps Script, Sheet, Drive), but its capture client and read-only viewer are now a hosted PWA at `inventory.mattrandell.com` (Cloudflare Pages, with the subdomain a Cloudflare DNS record — both managed by the Infrastructure's Terraform). See [inventory/docs/adr/0004](./inventory/docs/adr/0004-hosted-capture-and-viewer-pwa.md).

## System-wide decisions

- `docs/adr/` holds decisions that span contexts (monorepo layout, domain transfer). Context-specific decisions live under that context's own `docs/adr/` when they arise.
