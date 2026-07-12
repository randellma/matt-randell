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

# Slate — the app formerly served at divvy.mattrandell.com. The Divvy hostname
# is kept (above) but 301-redirected here by the dynamic-redirect ruleset in
# cloudflare.tf, so old share links keep resolving. The PocketBase backend
# stays at divvy-api.mattrandell.com (unchanged) so installed PWAs don't break.
resource "cloudflare_pages_project" "slate" {
  account_id        = "894ff489298bdf1ca445fc9469854b25"
  name              = "slate-mattrandell"
  production_branch = "main"
}

# Binds slate.mattrandell.com as a custom domain on the Pages project.
# Cloudflare verifies ownership via the DNS record below before activating TLS.
resource "cloudflare_pages_domain" "slate" {
  account_id   = "894ff489298bdf1ca445fc9469854b25"
  project_name = cloudflare_pages_project.slate.name
  name         = "slate.mattrandell.com"
}

resource "cloudflare_dns_record" "slate" {
  zone_id  = "cb009dc3da4929bf68ef21b73d4552f1"
  name     = "slate.mattrandell.com"
  type     = "CNAME"
  content  = "${cloudflare_pages_project.slate.name}.pages.dev"
  proxied  = true
  ttl      = 1
  tags     = []
  settings = {}
}
