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
