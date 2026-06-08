# Onboard existing Cloudflare infra into Terraform

**Type**: HITL
**Status**: done
**Blocked by**: None — can start immediately

## Parent

ADR-0003 — DNS authority is Cloudflare, not Cloud DNS (`docs/adr/0003-dns-on-cloudflare-not-cloud-dns.md`)

## What to build

Bring the Cloudflare infrastructure that already exists for `mattrandell.com` under the same Terraform root that manages GCP, by **importing** it rather than recreating it. Add the `cloudflare` provider alongside `google` (both share the existing GCS state backend), supply a scoped API token through the already-gitignored `*.tfvars` (or `CLOUDFLARE_API_TOKEN`), and adopt the existing zone, all DNS records, and the two Cloudflare Tunnels (`discount`, `discount-dev`). Use `cf-terraforming` to generate the HCL config and `import {}` blocks from the live account; the goal is a clean `plan` that reports **no changes** — proof the config matches reality with zero drift.

This is the prerequisite for retiring the dead Cloud DNS zone (#0013) and for managing the Inventory PWA's Cloudflare Pages site and subdomain record (#0015).

## Acceptance criteria

- [x] The `cloudflare/cloudflare` provider is added (pinned to a v5+ version) next to `google`; the API token is supplied via a gitignored `*.tfvars` or `CLOUDFLARE_API_TOKEN`, never committed
- [x] The existing Cloudflare zone, all DNS records, and both tunnels (`discount`, `discount-dev`) are present in both the Terraform config and state via import
- [x] `terraform plan` reports **no changes** (zero-drift adoption)
- [x] The API token is scoped to only the managed resources (Zone read/edit, DNS edit, and Zero-Trust/Tunnel as needed)

## Blocked by

- None — can start immediately

---

## Phase 1 — scaffolding (done, no secrets)

Committed to the Terraform root; no live account or token was touched:

- `terraform/providers.tf` — added `cloudflare/cloudflare` pinned `~> 5.0` (resolves to v5.19.1) and a `provider "cloudflare"` block whose `api_token = var.cloudflare_api_token`. When that var is `null`, the provider falls back to the `CLOUDFLARE_API_TOKEN` env var.
- `terraform/variables.tf` — `cloudflare_api_token`, `sensitive = true`, `default = null`. Supply via the gitignored `terraform/secret.tfvars` or the env var; never commit.
- `cf-terraforming` 0.27.0 installed (Homebrew) — supports `--modern-import-block` for config-driven `import {}` blocks (needs Terraform 1.5+; we're on `>= 1.9.0`).
- `terraform init -backend=false && terraform validate` → **valid**.

> Note: `terraform/dns.tf` (the Cloud DNS zone + records, including the two `cfargotunnel.com` CNAMEs) is intentionally **left in place** — deleting it is issue #0013. Phase 2 *adds* the Cloudflare resources alongside it.

## Phase 2 — live import (HITL runbook)

Run from `terraform/`. Nothing here is committed until the final `plan` is clean.

### 1. Mint a scoped API token

Cloudflare dash → My Profile → API Tokens → **Create Token** → Custom token. Scope it to exactly (AC #4):

| Scope | Resource | Permission |
|-------|----------|------------|
| Zone | Zone | Read |
| Zone | DNS | Edit |
| Account | Cloudflare Tunnel | Edit |

- **Zone Resources**: Include → Specific zone → `mattrandell.com`
- **Account Resources**: Include → your account

Then make it available to Terraform *and* cf-terraforming:

```sh
export CLOUDFLARE_API_TOKEN='<the-token>'
# or: echo 'cloudflare_api_token = "<the-token>"' > terraform/secret.tfvars   (gitignored)
```

### 2. Discover the zone and account IDs

```sh
export ZONE_ID=$(curl -s -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  "https://api.cloudflare.com/client/v4/zones?name=mattrandell.com" | jq -r '.result[0].id')
export ACCOUNT_ID=$(curl -s -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  "https://api.cloudflare.com/client/v4/zones?name=mattrandell.com" | jq -r '.result[0].account.id')
echo "zone=$ZONE_ID account=$ACCOUNT_ID"
```

### 3. Initialise the real backend

cf-terraforming reads the provider from the working dir, so init against the GCS backend first (needs your usual GCP ADC):

```sh
terraform init
```

### 4. Generate HCL + import blocks

`-t $CLOUDFLARE_API_TOKEN` is passed explicitly so cf-terraforming uses the token auth path. Generate config and modern `import {}` blocks per resource type:

```sh
# Zone (zone-scoped)
cf-terraforming generate -t "$CLOUDFLARE_API_TOKEN" --zone "$ZONE_ID" \
  --resource-type cloudflare_zone           >  cloudflare.tf
cf-terraforming import   -t "$CLOUDFLARE_API_TOKEN" --zone "$ZONE_ID" \
  --resource-type cloudflare_zone --modern-import-block >  cloudflare_imports.tf

# DNS records (zone-scoped)
cf-terraforming generate -t "$CLOUDFLARE_API_TOKEN" --zone "$ZONE_ID" \
  --resource-type cloudflare_dns_record     >> cloudflare.tf
cf-terraforming import   -t "$CLOUDFLARE_API_TOKEN" --zone "$ZONE_ID" \
  --resource-type cloudflare_dns_record --modern-import-block >> cloudflare_imports.tf

# Tunnels (account-scoped) — discount + discount-dev
cf-terraforming generate -t "$CLOUDFLARE_API_TOKEN" --account "$ACCOUNT_ID" \
  --resource-type cloudflare_zero_trust_tunnel_cloudflared     >> cloudflare.tf
cf-terraforming import   -t "$CLOUDFLARE_API_TOKEN" --account "$ACCOUNT_ID" \
  --resource-type cloudflare_zero_trust_tunnel_cloudflared --modern-import-block >> cloudflare_imports.tf
```

For reference, the two tunnel UUIDs (from the existing `dns.tf` CNAME targets) are
`discount = e75d6d99-e765-434a-a8a6-6619f821ccba` and
`discount-dev = 5986a706-c2c7-4be1-8762-5d602419c423`.

> If cf-terraforming can't emit a given resource type, fall back to config-driven import: hand-write the `import {}` block (using the IDs above / from step 2) and run `terraform plan -generate-config-out=cloudflare.tf` to let Terraform generate the HCL, then clean it up.

### 5. Import into state, then prove zero drift

```sh
terraform plan      # should show only "will be imported", no create/replace
terraform apply     # performs the imports recorded by the import {} blocks
terraform plan      # ← acceptance gate: must report "No changes"
```

Once the second `plan` is clean, delete `cloudflare_imports.tf` (the `import {}` blocks are one-shot) and commit `cloudflare.tf`, the updated `providers.tf`/`variables.tf`, and `.terraform.lock.hcl`. Add cloudflare assertions to `terraform/tests/` mirroring the existing `dns.tftest.hcl` style if you want the records covered by tests.

### Acceptance gate

`terraform plan` reporting **No changes** after `apply` is the proof of zero-drift adoption (AC #3). This unblocks #0013 (retire Cloud DNS) and #0015 (Pages site + subdomain).

## Phase 2 — result (done)

- `cf-terraforming` generated `terraform/cloudflare.tf` (zone, DNS records, both tunnels) and the one-shot `cloudflare_imports.tf` (`import {}` blocks).
- `terraform apply` imported all resources into state; `cloudflare_imports.tf` deleted post-apply.
- `terraform plan` → **No changes** — zero-drift adoption confirmed, all ACs met.
- `terraform/terraform` (binary downloaded by cf-terraforming) added to `terraform/.gitignore`.
