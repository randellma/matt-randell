resource "cloudflare_pages_project" "inventory" {
  account_id        = "894ff489298bdf1ca445fc9469854b25"
  name              = "inventory-mattrandell"
  production_branch = "main"
}

# Binds inventory.mattrandell.com as a custom domain on the Pages project.
# Cloudflare verifies ownership via the DNS record below before activating TLS.
resource "cloudflare_pages_domain" "inventory" {
  account_id   = "894ff489298bdf1ca445fc9469854b25"
  project_name = cloudflare_pages_project.inventory.name
  name         = "inventory.mattrandell.com"
}

resource "cloudflare_dns_record" "inventory" {
  zone_id  = "cb009dc3da4929bf68ef21b73d4552f1"
  name     = "inventory.mattrandell.com"
  type     = "CNAME"
  content  = "${cloudflare_pages_project.inventory.name}.pages.dev"
  proxied  = true
  ttl      = 1
  tags     = []
  settings = {}
}

resource "cloudflare_pages_project" "divvy" {
  account_id        = "894ff489298bdf1ca445fc9469854b25"
  name              = "divvy-mattrandell"
  production_branch = "main"
}

# Binds divvy.mattrandell.com as a custom domain on the Pages project.
# Cloudflare verifies ownership via the DNS record below before activating TLS.
resource "cloudflare_pages_domain" "divvy" {
  account_id   = "894ff489298bdf1ca445fc9469854b25"
  project_name = cloudflare_pages_project.divvy.name
  name         = "divvy.mattrandell.com"
}

resource "cloudflare_dns_record" "divvy" {
  zone_id  = "cb009dc3da4929bf68ef21b73d4552f1"
  name     = "divvy.mattrandell.com"
  type     = "CNAME"
  content  = "${cloudflare_pages_project.divvy.name}.pages.dev"
  proxied  = true
  ttl      = 1
  tags     = []
  settings = {}
}

# Slate — lives in the private heyslate repo since 2026-07: the heyslate.app
# zone, its Pages project (slate-mattrandell), and the domain bindings —
# including the slate.mattrandell.com binding, which is account-scoped — are
# Terraform-managed there. This repo keeps only the legacy shims in the
# mattrandell.com zone: this DNS record (slate.mattrandell.com still serves
# the app shell for the localStorage hand-off — see the ruleset comment in
# cloudflare.tf), the divvy.mattrandell.com 301, and divvy-api.mattrandell.com
# for installed PWAs pinned to the old origin. The vestigial divvy Pages
# project above is a retire-later candidate — the edge redirect means it
# never serves.
resource "cloudflare_dns_record" "slate" {
  zone_id  = "cb009dc3da4929bf68ef21b73d4552f1"
  name     = "slate.mattrandell.com"
  type     = "CNAME"
  content  = "slate-mattrandell.pages.dev"
  proxied  = true
  ttl      = 1
  tags     = []
  settings = {}
}
