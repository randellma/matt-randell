# Transfer domain to Cloud Domains

**Type**: HITL
**Blocked by**: #0003 — Cloud DNS zone must exist before transfer completes

## What to build

Transfer `mattrandell.com` from NearlyFreeSpeech into GCP Cloud Domains. After the transfer completes, point the domain's nameservers at the Cloud DNS zone created in #0003. From this point, all DNS for `mattrandell.com` is managed by Terraform.

Note: a 60-day re-transfer lock applies after the transfer completes (see ADR-0002).

## Acceptance criteria

- [ ] Domain unlocked at NearlyFreeSpeech and EPP auth code obtained
- [ ] Transfer initiated via Cloud Domains (Terraform resource or `gcloud domains registrations transfer`)
- [ ] Transfer confirmed and domain status shows active in Cloud Domains
- [ ] Nameservers updated to the Cloud DNS values output by #0003
- [ ] `dig mattrandell.com NS` returns Google Cloud DNS nameservers
- [ ] DNS propagation verified — A records resolve to GitHub Pages IPs
