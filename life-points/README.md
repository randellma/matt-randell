# Life Points walking skeleton

This directory contains the independently runnable first slice of Life Points:

- a mobile-first Vite welcome screen;
- PocketBase `0.40.4`, pinned and checksum-verified in the backend image;
- a versioned `GET /api/life-points/v1/health` hook;
- versioned migration, collection-rule, hook, and Starter Pack seed structure;
- one Compose stack shared by local development and black-box browser acceptance tests.

## Local development

Requirements: Docker with Compose v2.

```sh
docker compose up --build
```

Open <http://127.0.0.1:4173>. The browser reaches PocketBase at
<http://127.0.0.1:8090/api/life-points/v1/health>. Both ports can be changed without editing files:

```sh
LIFE_POINTS_WEB_PORT=5173 \
LIFE_POINTS_API_PORT=8091 \
LIFE_POINTS_API_URL=http://127.0.0.1:8091 \
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
project, waits for both services, runs the mobile Chromium welcome-to-health journey, and always
removes its containers and volumes.

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
`/pb/pb_data` in a named volume. Persistent storage must have an off-server backup before Account
or Game data is introduced.
