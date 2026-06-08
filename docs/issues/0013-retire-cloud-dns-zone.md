# Retire the Cloud DNS zone

**Type**: AFK
**Status**: closed

## Parent

ADR-0003 — DNS authority is Cloudflare, not Cloud DNS (`docs/adr/0003-dns-on-cloudflare-not-cloud-dns.md`)

## What to build

With DNS now served by Cloudflare and adopted into Terraform (#0012), remove the now-dead GCP Cloud DNS configuration. The Cloud DNS zone never served live traffic — the registrar's nameservers point at Cloudflare — so destroying it has no resolution impact. Delete the managed zone, all record sets, and the `nameservers` output in `terraform/dns.tf`, and remove the `dns.googleapis.com` service enable in `terraform/apis.tf`.

This reverses the output of issue 0003 (which created the Cloud DNS zone and GitHub Pages records); the equivalent records now live as Cloudflare resources.

## Acceptance criteria

- [x] Confirmed the registrar's nameservers point at Cloudflare and the Cloud DNS zone serves no live traffic before destroying it
- [x] `terraform/dns.tf` is removed (managed zone, all record sets, `nameservers` output)
- [x] The `dns.googleapis.com` enable is removed from `terraform/apis.tf`
- [x] `terraform apply` destroys the Cloud DNS zone with no impact on resolution of `mattrandell.com` or its subdomains

