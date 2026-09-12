# Life Points

This directory contains the independently runnable first slice of Life Points:

- a mobile-first Vite welcome and private Home screen;
- PocketBase `0.40.4`, pinned and checksum-verified in the backend image;
- a versioned `GET /api/life-points/v1/health` hook;
- passwordless PocketBase Accounts with eight-digit, three-minute email OTPs;
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

The versioned development seed provides two isolated Game Owners:

- `ysabel@example.test` — Ysabel, owner of `Ysabel's Life Points`;
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
and attempt cross-Game record mutations and protected-file reads. The runner always removes its
containers and volumes.

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

Life Points uses PocketBase's native OTP mailer. Local Compose points it at Mailpit; production
points the same mailer at Resend's SMTP service. Configure these environment variables on the
Life Points backend in Coolify before its first production deployment:

```text
LIFE_POINTS_PUBLIC_URL=https://lifepoints-api.mattrandell.com
LIFE_POINTS_WEB_URL=https://lifepoints.mattrandell.com
LIFE_POINTS_EMAIL_FROM_NAME=Life Points
LIFE_POINTS_EMAIL_FROM=hello@heyslate.app
LIFE_POINTS_SMTP_HOST=smtp.resend.com
LIFE_POINTS_SMTP_PORT=465
LIFE_POINTS_SMTP_USERNAME=resend
LIFE_POINTS_SMTP_PASSWORD=<Life Points sending-only Resend API key>
LIFE_POINTS_SMTP_TLS=true
LIFE_POINTS_OWNER_EMAIL=<Game Owner's real email address>
LIFE_POINTS_OWNER_NAME=Ysabel
LIFE_POINTS_GAME_TITLE=Ysabel's Life Points
```

Create a dedicated Resend API key with sending-only access to the already verified
`heyslate.app` domain. Do not commit the key. The boot hook reapplies mail configuration, the
public magic-link origin, and an explicitly configured Owner email on every restart, so changing
these Coolify values does not require editing the PocketBase Dashboard.
