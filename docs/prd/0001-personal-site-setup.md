# Personal Site Setup — Monorepo, GCP Infrastructure, and Domain Transfer

## Problem Statement

My personal website lives across three fragmented, uncoordinated places: content in a separate `randellma.github.io` GitHub repo running Jekyll (which I no longer want to use), a domain registered at NearlyFreeSpeech.net with no infrastructure-as-code, and no GCP infrastructure at all. There is no single place to manage the site and its infrastructure together, and none of it is reproducible or version-controlled beyond the content itself.

## Solution

A single monorepo (`matt-randell`) that consolidates site content and GCP infrastructure configuration. The domain `mattrandell.com` transfers to GCP Cloud Domains and DNS moves to Cloud DNS — both fully managed by Terraform. Site content migrates from `randellma.github.io` into a `/site` folder in this repo, deployed automatically to GitHub Pages via GitHub Actions on every push to `main`. The old repo is archived once the migration is complete.

## User Stories

1. As the site owner, I want all my personal site concerns in one repo, so that I don't have to context-switch between multiple places to make changes.
2. As the site owner, I want my GCP infrastructure defined as code, so that it is reproducible and auditable via git history.
3. As the site owner, I want Terraform state stored remotely in GCS, so that it is durable and not accidentally committed to the repo.
4. As the site owner, I want Cloud DNS and Cloud Domains managed by Terraform, so that DNS changes are reviewed and applied consistently.
5. As the site owner, I want `mattrandell.com` to be the canonical URL for my site, so that visitors reach me at a professional, personal domain.
6. As the site owner, I want `www.mattrandell.com` to redirect to `mattrandell.com`, so that both forms of the URL work.
7. As the site owner, I want my site served over HTTPS, so that browsers don't show security warnings.
8. As the site owner, I want the domain registered directly in GCP, so that all infrastructure is managed in one cloud provider.
9. As the site owner, I want the site to deploy automatically when I push to `main`, so that publishing is frictionless.
10. As the site owner, I want the old `randellma.github.io` repo archived, so that there is a single canonical source of truth for site content.
11. As the site owner, I want to abandon Jekyll, so that I can use a simpler or more modern static site generator in the future.
12. As the site owner, I want the site content isolated in a `/site` folder, so that it is clearly separated from infrastructure config.
13. As the site owner, I want DNS records managed via Terraform, so that adding or changing records follows the same code-review workflow as everything else.
14. As the site owner, I want the Terraform bootstrap process documented, so that I can reproduce the setup from scratch if needed.

## Implementation Decisions

### Monorepo structure

Site content lives in `/site`, Terraform configuration lives in `/terraform`, and GitHub Actions workflows live in `.github/workflows/`. These are the only top-level concerns — there is no application server, no backend, and no database. See ADR-0001.

### Terraform backend

Terraform state is stored in a GCS bucket that is bootstrapped manually with a single `gcloud` command before `terraform init`. The bucket itself is not managed by Terraform (to avoid the circular bootstrapping dependency). All other GCP resources are managed by Terraform.

### GCP APIs

Cloud Domains and Cloud DNS APIs are enabled via `google_project_service` Terraform resources in the `matt-randell` GCP project.

### Cloud DNS zone

A managed zone for `mattrandell.com` is created via Terraform. It contains:
- Four A records for the apex domain (`mattrandell.com`) pointing to GitHub Pages IPs: `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
- One CNAME record for `www.mattrandell.com` pointing to `randellma.github.io.`

The Cloud DNS nameservers are output by Terraform for use during the domain transfer.

### Domain transfer

`mattrandell.com` is transferred from NearlyFreeSpeech into GCP Cloud Domains (see ADR-0002). The transfer is initiated manually (EPP auth code from NearlyFreeSpeech, transfer via Cloud Domains), and nameservers are updated to Cloud DNS after the transfer completes. A 60-day re-transfer lock applies post-transfer.

### GitHub Pages deployment

GitHub Pages is enabled on the `matt-randell` repo and serves from the output of a GitHub Actions workflow (not directly from a branch folder). The workflow builds the site from `/site` and deploys it on every push to `main`.

### Static site generator

The current Jekyll site is being abandoned. The replacement generator — plain HTML/CSS or Hugo — is not yet decided and is out of scope for this PRD. The `/site` folder may be populated with a placeholder until that decision is made.

### Custom domain activation

`mattrandell.com` is set as the custom domain in GitHub Pages settings after the domain transfer completes and DNS propagates. GitHub Pages provisions a Let's Encrypt HTTPS certificate automatically.

## Testing Decisions

This is a personal infrastructure and static site project — there is no application logic to unit-test. What makes a good test here is verifying observable external behaviour: does the infrastructure actually deploy, does the site actually load, does DNS actually resolve.

- **Terraform**: `terraform plan` run in CI (GitHub Actions) on pull requests to validate that changes produce expected resource diffs. `terraform apply` is manual.
- **Site deployment**: The GitHub Actions deploy workflow validates that the site builds successfully before deploying. A failed build blocks deployment.
- **DNS**: Manual verification post-transfer using `dig mattrandell.com A` and `dig www.mattrandell.com CNAME`.
- **HTTPS**: Manual verification that `https://mattrandell.com` loads without certificate warnings after GitHub Pages provisions the cert.

No automated integration tests are planned — the surface area is small and the verification steps above are sufficient for a personal site.

## Out of Scope

- Choosing and implementing a replacement static site generator (deferred — the site generator decision and migration from Jekyll is a separate effort)
- Analytics, monitoring, or uptime alerting
- Automated `terraform apply` in CI (apply is intentionally manual)
- Any server-side functionality — the site is purely static
- Email hosting or MX records for `mattrandell.com`
- Multi-environment setup (staging/production) — there is one environment

## Further Notes

- The six implementation issues in `docs/issues/` capture the ordered work breakdown. Issues #0001 (Terraform bootstrap) and #0005 (site migration) can be worked in parallel; all others have explicit blockers.
- The domain transfer (issue #0004) involves a mandatory waiting period while the transfer processes at the registry level — this can take up to 7 days.
- After the transfer completes, NearlyFreeSpeech no longer has any role in the infrastructure.
