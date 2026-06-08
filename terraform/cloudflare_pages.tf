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
