# Coolify as self-hosted PaaS on the Home Server

---
Status: accepted
---

All self-hosted services on the Home Server are managed by **Coolify** rather than raw Docker Compose files maintained per-service.

## Why

The previous model — Docker Compose installed directly, each service with its own `docker-compose.yml`, deployed by SSHing in and running `git pull` + `docker build` + `docker compose up` — does not scale beyond one or two services. Each new service adds another manual deploy procedure, another compose file to maintain, and no unified view of what is running.

Coolify replaces this with a single control plane on the Home Server that:
- connects to private GitHub repos and auto-deploys on push (eliminating the manual SSH deploy loop)
- manages environment variables securely through its UI rather than `.env` files on disk
- provides build logs, deployment history, and failure notifications out of the box
- bundles Traefik as a reverse proxy, so one Cloudflare Tunnel serves all services without per-app tunnel sidecars
- supports Docker Compose apps natively, so existing `docker-compose.yml` files work without rewriting

The alternatives considered were: continuing with raw Docker Compose + GitHub Actions SSH deploy (doesn't scale, one workflow per service), and Portainer (adds a UI but doesn't solve the deploy pipeline).

## Consequences

- The `tunnel` sidecar service is removed from the discount app's `docker-compose.yml`; the tunnel runs as a Coolify-managed service at the server level instead.
- Environment variables previously held in `.env` on disk move to Coolify's secret management.
- Coolify itself is a service that must be kept running and updated; it becomes a dependency for all other services.
- New services are added via Coolify's UI (connected to their GitHub repo) rather than by cloning a repo and writing a compose file.
