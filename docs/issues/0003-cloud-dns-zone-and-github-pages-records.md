# Create Cloud DNS zone with GitHub Pages records

**Type**: AFK
**Blocked by**: #0002 — Enable GCP APIs

## What to build

Create a Cloud DNS managed zone for `mattrandell.com` and populate it with the DNS records needed to serve the Site from GitHub Pages. The apex domain (`mattrandell.com`) is canonical; `www` redirects to it via GitHub's automatic redirect behaviour.

## Acceptance criteria

- [ ] `google_dns_managed_zone` resource created for `mattrandell.com`
- [ ] A records added for the apex domain pointing to all four GitHub Pages IPs: `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
- [ ] CNAME record added for `www.mattrandell.com` pointing to `randellma.github.io.`
- [ ] Cloud DNS nameservers output by Terraform (needed for the domain transfer in #0004)
- [ ] `terraform apply` succeeds with no errors
