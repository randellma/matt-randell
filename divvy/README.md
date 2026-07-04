# Divvy

Self-hosted expense splitting for friends and family — a low-friction Splitwise
alternative. No accounts: create a group, share the link, and anyone with the
link can log expenses as themselves (or anyone else in the group). The killer
feature is receipt scanning: photograph a receipt, Claude extracts the line
items, and you tap names to assign items — tax and tip are divided
proportionally to what each person ordered.

Couples and families can be linked into a **party** (Balances tab): they order
individually but settle as one wallet, so group balances stay simple while the
internal breakdown remains visible.

- **PWA**: `divvy.mattrandell.com` (Cloudflare Pages) — Preact + Vite, in [`web/`](web/)
- **Backend**: `divvy-api.mattrandell.com` — PocketBase on the Home Server (Coolify,
  via the Cloudflare Tunnel), defined in [`server/`](server/)

See [CONTEXT.md](CONTEXT.md) for the domain language and [docs/adr/](docs/adr/) for decisions.

## Local development

```sh
# backend — download a pocketbase binary (v0.39.x), then from a scratch dir:
ANTHROPIC_API_KEY=sk-... ./pocketbase serve \
  --migrationsDir <repo>/divvy/server/pb_migrations \
  --hooksDir <repo>/divvy/server/pb_hooks \
  --http 127.0.0.1:8090

# frontend
cd divvy/web
npm install
npm run dev        # defaults to the local backend at 127.0.0.1:8090
npm test           # split-math unit tests
```

To test receipt OCR without spending API credits, point the hook at a mock:
`DIVVY_OCR_API_BASE=http://127.0.0.1:8099` (any server that speaks the
Messages API response shape).

## Deployment

**PWA** deploys automatically: pushes to `main` touching `divvy/web/**` run
[`deploy-divvy-pwa.yml`](../.github/workflows/deploy-divvy-pwa.yml), which
builds and pushes `dist/` to the `divvy-mattrandell` Pages project. The Pages
project, custom domain, and both DNS records are Terraform-managed
(`terraform/cloudflare_pages.tf`, `terraform/cloudflare.tf`) — run
`terraform apply` once before first deploy.

**Backend** is a Coolify app on the Home Server (same pattern as
`inventory-api`):

1. In Coolify, create an app from this repo with build context `divvy/server/`
   (Dockerfile build).
2. Add a persistent volume mounted at `/pb/pb_data`.
3. Set env vars: `ANTHROPIC_API_KEY` (required for receipt OCR); optionally
   `DIVVY_OCR_MODEL` (default `claude-haiku-4-5`).
4. Expose port 8080 and add the `divvy-api.mattrandell.com` domain so Traefik
   routes it through the existing Cloudflare Tunnel.
5. On first boot, migrations auto-apply. Create the superuser for the admin UI
   with `./pocketbase superuser upsert <email> <pass>` inside the container
   (only needed for admin access — the app itself never uses it).

## How access works

There is deliberately no auth beyond the group link. Each group has a random
token; the share link embeds it (`/#/g/<id>/<token>`), the PWA stores it in
localStorage and sends it as `?t=` on every request, and PocketBase collection
rules verify it. Anyone with the link can read and write everything in that
group — that's the product, not a bug. See
[ADR-0001](docs/adr/0001-no-accounts-link-token-access.md).
