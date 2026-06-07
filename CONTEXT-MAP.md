# Context Map

This repo holds more than one domain. Each context has its own glossary.

## Contexts

- [Site & Infrastructure](./CONTEXT.md) — the static website at `mattrandell.com` (GitHub Pages) and the GCP resources (Cloud Domains, Cloud DNS) that route to it
- [Inventory](./inventory/CONTEXT.md) — capturing household items to declutter and tracking how each one leaves the house

## Relationships

- **Inventory → Site & Infrastructure**: Currently independent — Inventory lives entirely in Google (Apps Script, Sheet, Drive) and touches no Infrastructure. *If* a hosted viewer is ever built, it would sit under a subdomain (`inventory.mattrandell.com`) whose DNS the Infrastructure would then manage.

## System-wide decisions

- `docs/adr/` holds decisions that span contexts (monorepo layout, domain transfer). Context-specific decisions live under that context's own `docs/adr/` when they arise.
