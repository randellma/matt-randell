# Slate

Self-hosted expense splitting for friends and family — a low-friction Splitwise
alternative. No accounts: create a group, share the link, and anyone with the
link can log expenses as themselves (or anyone else in the group). The killer
feature is receipt scanning: photograph a receipt, Claude extracts the line
items, and you tap names to assign items — tax and tip are divided
proportionally to what each person ordered.

Couples and families can be linked into a **party** (Balances tab): they order
individually but settle as one wallet, so group balances stay simple while the
internal breakdown remains visible.

> **Rebrand/domain note:** this app was previously **Divvy**, then lived at
> `slate.mattrandell.com`; it now has its own domain, **heyslate.app**.
> `divvy.mattrandell.com` 301-redirects there, and `slate.mattrandell.com`
> still serves the app shell so it can hand off localStorage group tokens
> client-side ([`web/src/migrate.ts`](web/src/migrate.ts)) — only its
> path-form share links (`/g/*`, `/og/*`) are edge-redirected. PocketBase
> routes (`/api/divvy/*`) and `DIVVY_*` env vars deliberately keep the old
> name, and the old backend host `divvy-api.mattrandell.com` stays answering
> alongside `api.heyslate.app` so already-installed PWAs don't break.

- **PWA**: `heyslate.app` (Cloudflare Pages) — Preact + Vite, in [`web/`](web/)
- **Backend**: `api.heyslate.app` — PocketBase on the Home Server (Coolify,
  via the Cloudflare Tunnel), defined in [`server/`](server/)

See [CONTEXT.md](CONTEXT.md) for the domain language and [docs/adr/](docs/adr/) for decisions.

## Local development

```sh
# backend — download a pocketbase binary (v0.39.x), then from a scratch dir:
ANTHROPIC_API_KEY=sk-... ./pocketbase serve \
  --migrationsDir <repo>/slate/server/pb_migrations \
  --hooksDir <repo>/slate/server/pb_hooks \
  --http 127.0.0.1:8090

# frontend
cd slate/web
npm install
npm run dev        # defaults to the local backend at 127.0.0.1:8090
npm test           # split-math unit tests
```

To test receipt OCR without spending API credits, point the hook at a mock:
`DIVVY_OCR_API_BASE=http://127.0.0.1:8099` (any server that speaks the
Messages API response shape).

## Deployment

**PWA** deploys automatically: pushes to `main` touching `slate/web/**` run
[`deploy-slate-pwa.yml`](../.github/workflows/deploy-slate-pwa.yml), which
builds and pushes `dist/` to the `slate-mattrandell` Pages project (serving
`heyslate.app` plus the legacy `slate.mattrandell.com`). The Pages project,
custom domains, the legacy-host redirects, and all DNS records are
Terraform-managed (`terraform/cloudflare_pages.tf`, `terraform/cloudflare.tf`,
`terraform/heyslate.tf`) — run `terraform apply` once before first deploy.

**Backend** is a Coolify app on the Home Server (same pattern as
`inventory-api`):

1. In Coolify, create an app from this repo with build context `slate/server/`
   (Dockerfile build). *(If migrating the existing Divvy deploy, update its
   build context from `divvy/server/` to `slate/server/` after the directory
   rename, or the next server build fails on a missing path.)*
2. Add a persistent volume mounted at `/pb/pb_data`.
3. Set env vars: `ANTHROPIC_API_KEY` (required for receipt OCR);
   `RESEND_API_KEY` (required for PIN-recovery and sign-in-code emails — see
   below); optionally `DIVVY_GOOGLE_CLIENT_ID` + `DIVVY_GOOGLE_CLIENT_SECRET`
   (enables Google sign-in — see below),
   `DIVVY_OCR_MODEL` (default `claude-haiku-4-5`), `DIVVY_EMAIL_FROM`
   (default `Slate <hello@heyslate.app>`), and `DIVVY_APP_URL` (default
   `https://heyslate.app`). The `DIVVY_*` env var **names** are kept
   from the old brand so existing deployments need no env changes — but if
   you previously **set** `DIVVY_APP_URL` or `DIVVY_EMAIL_FROM` to older
   values, update (or unset) them so emails come from the current host. The
   default sender requires `heyslate.app` to be verified in Resend (see
   below) **before** this code is deployed, or sign-in/recovery emails fail.
4. Expose port 8080 and add **both** `api.heyslate.app` and
   `divvy-api.mattrandell.com` as domains so Traefik routes them through the
   existing Cloudflare Tunnel (the old host stays answering for installed
   PWAs pinned to the old origin).
5. On first boot, migrations auto-apply. Create the superuser for the admin UI
   with `./pocketbase superuser upsert <email> <pass>` inside the container
   (only needed for admin access — the app itself never uses it).

## Accounts & scan credits (beta)

Receipt scanning is metered by **scan credits** on an optional account —
the only thing in Slate that has one (see
[ADR-0004](docs/adr/0004-scan-credits-optional-accounts.md)). Sign-in is
PocketBase-native (ADR-0005): a 6-digit code emailed via Resend
(`requestOTP`/`authWithOTP`, with hooks adding auto-create on first contact,
a 60s resend cooldown, and a 5-try cap per code) or, when configured,
Google — never a password. First sign-in grants 5 credits; packs
(10/$2.99, 30/$6.99) are
recorded through `/api/divvy/credits/purchase` and, while in beta, granted
free — the `purchases` row carries `status`/`provider`/`provider_ref` so a
real payment provider can slot in later without schema changes.

A scan (receipt created with `status: pending`) charges the scanner's own
balance first, else a **sponsor**: any account that toggled "cover this
group's scans" (Group settings). Sponsoring is a draw permission, not a
transfer; the sponsor with the largest balance is charged. No credits
anywhere → the create is refused with HTTP 402 and the PWA opens the top-up
sheet. Credits are only spent on *successful* parses, and every movement is a
`credit_events` ledger row behind the `users.credits` balance.

Attaching a receipt photo without scanning stays free and account-less.

## How access works

There is deliberately no auth beyond the group link. Each group has a random
token; the share link embeds it (`/#/g/<id>/<token>`), the PWA stores it in
localStorage and sends it as `?t=` on every request, and PocketBase collection
rules verify it. Anyone with the link can read and write everything in that
group — that's the product, not a bug. See
[ADR-0001](docs/adr/0001-no-accounts-link-token-access.md).

Optionally, a group can turn on a 4–6 digit **PIN** (Group settings → PIN &
recovery). Its share link then carries only the group id, and new people must
type the PIN to get the token; ten wrong tries lock joining until a member
unlocks it. Enabling the PIN rotates the token, so links shared beforehand
stop granting access (current members just re-enter with the PIN once). A
recovery email address can be set per group — the join screen's "forgot the
PIN?" button emails that address the group's access link. See
[ADR-0003](docs/adr/0003-optional-group-pin.md).

## Google sign-in (optional)

"Continue with Google" uses PocketBase's native OAuth2 provider (ADR-0005)
and is wired entirely from env: the sign-in sheet only shows the button when
the server reports the provider, so the feature deploys safely with no
credentials — the flow stays email-code only until they exist. One-time
setup:

1. In the [Google Cloud console](https://console.cloud.google.com/apis/credentials),
   create an **OAuth client ID** of type *Web application* (configure the
   OAuth consent screen first if the project has none). Add
   `https://api.heyslate.app/api/oauth2-redirect` as an **authorized
   redirect URI** — the redirect goes to the PocketBase host, not the PWA.
   (Keep `https://divvy-api.mattrandell.com/api/oauth2-redirect` listed too
   while installed PWAs on the old origin are still around.)
2. Set `DIVVY_GOOGLE_CLIENT_ID` and `DIVVY_GOOGLE_CLIENT_SECRET` on the
   backend (Coolify env vars) and restart — a boot hook writes them into the
   users collection's OAuth2 config, and the button appears.

Google sign-in lands on the existing account when the (verified) email
already signed in by code — credits, purchases, and sponsorships carry over —
and fills an empty profile name/photo from the Google profile without ever
overwriting values the user set. Removing the env vars disables the provider
again on next boot.

## Recovery & sign-in emails (Resend)

Recovery emails and account sign-in codes go out through
[Resend](https://resend.com)'s HTTP API from PocketBase hooks — no SMTP
setup. One-time setup:

1. In the Resend dashboard, verify the sending domain (`heyslate.app`,
   region `us-east-1`): the MX/SPF/DMARC records are already in
   `terraform/heyslate.tf`; paste the DKIM key Resend mints into the
   commented `heyslate_resend_dkim` record there and `terraform apply`.
   Create an API key (sending-only, its own key per app is good hygiene).
2. Set `RESEND_API_KEY` on the backend (Coolify env var, next to
   `ANTHROPIC_API_KEY`). Without it, everything works except recovery emails,
   which fail with a clear "not configured" message.
3. Optionally set `DIVVY_EMAIL_FROM` — must be an address on the verified
   domain.
