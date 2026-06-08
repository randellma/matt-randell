# DNS authority is Cloudflare, not Cloud DNS

---
Status: accepted (supersedes the registrar-and-DNS-together rationale of ADR-0002)
---

DNS for `mattrandell.com` is served by **Cloudflare**, and the GCP Cloud DNS managed zone in `terraform/dns.tf` is **retired**. Both GCP and Cloudflare are managed from the single Terraform root (multi-provider, same GCS state backend); the existing Cloudflare resources are **adopted by import**, not recreated.

## Why

Cloudflare is already the de-facto authority — the registrar's nameservers point at it, and it already serves the live records plus the `discount` / `discount-dev` Cloudflare Tunnels (`cfargotunnel.com` in the old `dns.tf`). The Cloud DNS zone was config that **never served traffic**: a second, drifted source of truth. With the Inventory PWA now hosted on Cloudflare Pages (see [inventory/docs/adr/0004](../../inventory/docs/adr/0004-hosted-capture-and-viewer-pwa.md)), the centre of gravity for the edge — DNS, tunnels, static hosting — is unambiguously Cloudflare. Consolidating DNS there removes the drift and puts DNS next to the things it points at.

## Relationship to ADR-0002

[ADR-0002](0002-full-domain-transfer-to-cloud-domains.md) moved the *registrar* to GCP Cloud Domains expressly to keep **registrar + DNS under one provider** and avoid "splitting ownership between two providers." This decision **deliberately re-splits them**: registrar stays GCP (Cloud Domains — that part of ADR-0002 stands), DNS moves to Cloudflare. The "one provider for both" rationale is superseded because the practical reality — live nameservers, tunnels, and now Pages — is already Cloudflare, so the real "single place" is Cloudflare DNS, not Cloud DNS. The single-Terraform-root keeps it all manageable from one place regardless of which clouds the resources live in.

## How (onboarding the existing infra)

- Add the `cloudflare/cloudflare` provider alongside `hashicorp/google`; configure it with a scoped API token held in the already-gitignored `*.tfvars` (or `CLOUDFLARE_API_TOKEN`), never in git.
- Adopt existing Cloudflare resources (zone, DNS records, the two tunnels) via **import** — `cf-terraforming` generates the HCL + `import {}` blocks; a clean `plan` showing no changes confirms zero-drift adoption.
- Pin a recent Cloudflare provider version (the v5 rewrite renamed resources, e.g. `cloudflare_record` → `cloudflare_dns_record`); match `cf-terraforming` and docs to it.

## Consequences

- `terraform/dns.tf` (the Cloud DNS zone, all record sets, the `nameservers` output) is deleted; the equivalent records become Cloudflare resources. The `dns.googleapis.com` enable in `apis.tf` can go too.
- A Cloudflare API token now lives in Terraform's inputs and state — handle as a secret.
- The apex still points at GitHub Pages, now via a Cloudflare record: keep it **DNS-only (grey cloud)** or set SSL to **Full**, or proxied HTTPS to GitHub Pages breaks.
