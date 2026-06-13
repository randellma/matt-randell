# Single Cloudflare Tunnel at server level, routing through Traefik

---
Status: accepted
---

One Cloudflare Tunnel runs at the Home Server level, terminating at Coolify's built-in Traefik instance. All public subdomains route through this single tunnel. Tunnel routing rules are defined in Terraform via `cloudflare_zero_trust_tunnel_cloudflared_config`.

## Why

The previous model ran `cloudflared` as a sidecar inside the discount app's Docker Compose stack, giving each app its own tunnel identity. This ties tunnel lifecycle to app lifecycle — if the app container is stopped for maintenance, the tunnel drops too. It also means adding a new public service requires a new tunnel resource and new Terraform DNS record with no shared routing layer.

The server-level tunnel model means:
- The tunnel is always up regardless of which app services are running or restarting
- Adding a new service is one Terraform change (a routing rule + DNS record pointing at a new Traefik backend) rather than a new tunnel + compose sidecar
- Traefik handles TLS termination and hostname-to-service routing internally; services don't need to know they're behind a tunnel

Tunnel routing config lives in Terraform (not Coolify's UI) so that all routing decisions are in git, reviewable, and agent-controllable with human approval via PR.

## Consequences

- The `tunnel` service is removed from `wayfair-apps/wayfair-discount-ui/docker-compose.yml`; `TUNNEL_TOKEN` moves from the app's environment to Coolify's server-level configuration.
- Adding a new public subdomain requires a Terraform change in `matt-randell` (DNS record + tunnel routing rule) in addition to the Coolify service setup in `wayfair-apps`.
- The tunnel Terraform resource (`cloudflare_zero_trust_tunnel_cloudflared`) already exists; this ADR adds the `cloudflare_zero_trust_tunnel_cloudflared_config` resource to manage routing rules.
