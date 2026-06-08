# Matt Randell Personal Site

A monorepo managing both the static website content and the cloud infrastructure (GCP domain registration; Cloudflare DNS, tunnels, and static hosting) for `mattrandell.com`.

## Language

**Site**:
The static website served at `mattrandell.com` via GitHub Pages; source files live in `/site`.
_Avoid_: App, application, page, project

**Infrastructure**:
The cloud resources managed by Terraform — domain registration in GCP Cloud Domains, plus DNS, tunnels, and static hosting on Cloudflare; configuration lives in `/terraform`. Registrar (GCP) and DNS authority (Cloudflare) are deliberately split — see `docs/adr/0003`.
_Avoid_: Backend, config, cloud

**Bootstrap**:
The one-time manual step — creating the GCS state bucket — that must happen before Terraform can manage any Infrastructure.
_Avoid_: Init, setup

## Relationships

- The **Site** is built from source in `/site` and deployed to GitHub Pages via GitHub Actions
- The **Infrastructure** manages the domain registration (GCP) and the Cloudflare DNS records that route `mattrandell.com` to GitHub Pages and the subdomains to their hosts
- **Bootstrap** is a prerequisite to managing any **Infrastructure** with Terraform

## Example dialogue

> **Matt:** "Do I need to update the **Infrastructure** when I push a change to the **Site**?"
> **Claude:** "No — the **Infrastructure** only changes when DNS records or domain settings change. **Site** changes deploy independently via GitHub Actions."

## Flagged ambiguities

- "project" was used to mean both the GCP project (`matt-randell`) and the overall personal site effort — resolved: use **Infrastructure** for the GCP context, **Site** for the website content.
