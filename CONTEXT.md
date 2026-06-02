# Matt Randell Personal Site

A monorepo managing both the static website content and the GCP infrastructure (domain registration, DNS) for `mattrandell.com`.

## Language

**Site**:
The static website served at `mattrandell.com` via GitHub Pages; source files live in `/site`.
_Avoid_: App, application, page, project

**Infrastructure**:
The GCP resources (Cloud Domains registration, Cloud DNS zone) managed by Terraform; configuration lives in `/terraform`.
_Avoid_: Backend, config, cloud

**Bootstrap**:
The one-time manual step — creating the GCS state bucket — that must happen before Terraform can manage any Infrastructure.
_Avoid_: Init, setup

## Relationships

- The **Site** is built from source in `/site` and deployed to GitHub Pages via GitHub Actions
- The **Infrastructure** manages the domain registration and DNS records that route `mattrandell.com` to GitHub Pages
- **Bootstrap** is a prerequisite to managing any **Infrastructure** with Terraform

## Example dialogue

> **Matt:** "Do I need to update the **Infrastructure** when I push a change to the **Site**?"
> **Claude:** "No — the **Infrastructure** only changes when DNS records or domain settings change. **Site** changes deploy independently via GitHub Actions."

## Flagged ambiguities

- "project" was used to mean both the GCP project (`matt-randell`) and the overall personal site effort — resolved: use **Infrastructure** for the GCP context, **Site** for the website content.
