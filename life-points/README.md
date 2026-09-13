# Life Points

This directory contains the independently runnable first slice of Life Points:

- a mobile-first Vite welcome and private Home screen;
- PocketBase `0.40.4`, pinned and checksum-verified in the backend image;
- a versioned `GET /api/life-points/v1/health` hook;
- passwordless PocketBase Accounts with eight-digit, three-minute email OTPs;
- verified public Account and Game onboarding without invitations;
- transactionally provisioned Categories, Activities, Rewards, and Monthly Quest slots;
- a Game-scoped quick-add flow with immutable Activity and Category snapshots;
- immediate History, Lifetime Points, and Available Points updates after logging;
- Game-scoped record and protected-file rules;
- versioned migration, collection-rule, hook, and Starter Pack seed structure;
- one Compose stack shared by local development and black-box browser acceptance tests.

## Local development

Requirements: Docker with Compose v2.

```sh
docker compose up --build
```

Open <http://127.0.0.1:4173>. The browser reaches PocketBase at
<http://127.0.0.1:8090/api/life-points/v1/health>. Captured development email is available in
Mailpit at <http://127.0.0.1:8025>.

Visitors can start an independent Game with any valid email address. Life Points creates only a
pending Account before the email OTP is used; Player Name, Game, ownership, and the complete
Starter Pack are committed together after verification. Repeating either registration or
provisioning reuses the same Account and Game.

From Home, a Player can open quick-add, choose an active Starter Pack Activity grouped by
Category, and save it for today's local calendar date. The resulting Activity Entry snapshots
the Activity and Category presentation used at award time; History and point totals refresh
immediately without a page reload.

The versioned development seed also provides two isolated Game Owners:

- `ysabel08@gmail.com` — Ysabel, owner of `Ysabel's Life Points`;
- `friend@example.test` — Rowan, owner of `Rowan's Life Points`.

The web, API, and mail ports can be changed without editing files:

```sh
LIFE_POINTS_WEB_PORT=5173 \
LIFE_POINTS_API_PORT=8091 \
LIFE_POINTS_API_URL=http://127.0.0.1:8091 \
LIFE_POINTS_MAIL_PORT=8026 \
docker compose up --build
```

PocketBase data lives in a named Docker volume. Stop the stack with `docker compose down`; add
`--volumes` only when you intentionally want a fresh local database.

## Build and acceptance test

```sh
npm ci
npm run build
npx playwright install chromium
npm test
```

`npm test` selects available host ports, starts the complete stack under an isolated Compose
project, waits for all services, and runs the mobile Chromium journeys. The tests retrieve real
OTP credentials from Mailpit, cover code and magic-link entry, session restoration and sign-out,
public signup, complete idempotent Starter Pack provisioning, and cross-Game record mutations and
protected-file reads. The runner always removes its containers and volumes.

## Production hosting

The frontend is deployed to Cloudflare Pages at <https://lifepoints.mattrandell.com>. Its
production build calls PocketBase at <https://lifepoints-api.mattrandell.com>. Pages, both DNS
records, and the shared Cloudflare Tunnel ingress are managed in `/terraform`.

After the one-time Infrastructure and Coolify setup, pushes to `main` that touch `life-points/**`
run the isolated acceptance test, build with the production API URL, and deploy `dist` to the
`life-points-mattrandell` Pages project. Pull requests run the same tests and build without
deploying.

The PocketBase Coolify application builds from `/life-points/backend/Dockerfile`, exposes port
`8090`, sets `LIFE_POINTS_PUBLIC_URL=https://lifepoints-api.mattrandell.com`, and persists
`/pb/pb_data` in a named volume. Deploy the Account and Game migration only after persistent
storage has an off-server backup and production SMTP is configured.

### Production email and seeded Game Owner

Life Points uses PocketBase's native OTP flow. Local Compose delivers through Mailpit;
production's OTP mail hook delivers through Resend's HTTP API, matching HeySlate. Configure these
environment variables on the Life Points backend in Coolify before its first production deploy:

```text
LIFE_POINTS_PUBLIC_URL=https://lifepoints-api.mattrandell.com
LIFE_POINTS_WEB_URL=https://lifepoints.mattrandell.com
RESEND_API_KEY=<Life Points sending-only Resend API key>
```

Create a dedicated Resend API key with sending-only access to the already verified
`heyslate.app` domain. Do not commit the key. The seeded Game Owner is intentionally fixed in the
migration as `ysabel08@gmail.com`, with Player Name `Ysabel` and Game title
`Ysabel's Life Points`.
