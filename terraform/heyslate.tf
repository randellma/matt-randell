# heyslate.app — Slate's real domain (2026-07). The PWA moved here from
# slate.mattrandell.com and the PocketBase backend to api.heyslate.app (the
# backend kept its old divvy-api host through the Divvy→Slate rebrand; this
# migration finally moves it too). The old hosts stay alive:
#   - slate.mattrandell.com still serves the app shell, which hands off
#     localStorage group tokens client-side (see slate/web/src/migrate.ts)
#     — only path-form share links (/g/*, /og/*) are edge-redirected, since
#     they carry their credentials in the URL and store nothing locally.
#   - divvy-api.mattrandell.com keeps serving PocketBase so already-installed
#     PWAs (pinned to the old origin by their service worker) don't break.
#
# The zone was created when the domain was registered, so it's imported
# rather than created; the import block is a no-op once state has it.

import {
  to = cloudflare_zone.heyslate
  id = "de49d2021df8ea9f57f9564ee2b8f467"
}

resource "cloudflare_zone" "heyslate" {
  name = "heyslate.app"
  type = "full"
  account = {
    id = "894ff489298bdf1ca445fc9469854b25"
  }
}

# Binds heyslate.app as a custom domain on the existing slate Pages project —
# both hostnames serve the same deployment, so the old origin can keep
# serving the shell for the localStorage hand-off.
resource "cloudflare_pages_domain" "slate_heyslate" {
  account_id   = "894ff489298bdf1ca445fc9469854b25"
  project_name = cloudflare_pages_project.slate.name
  name         = "heyslate.app"
}

# Apex CNAME — Cloudflare flattens it automatically.
resource "cloudflare_dns_record" "heyslate_apex" {
  zone_id  = cloudflare_zone.heyslate.id
  name     = "heyslate.app"
  type     = "CNAME"
  content  = "${cloudflare_pages_project.slate.name}.pages.dev"
  proxied  = true
  ttl      = 1
  tags     = []
  settings = {}
}

# www exists only to 301 to the apex (ruleset below runs before any origin
# fetch, so this record never actually serves — it just needs to be proxied
# for Cloudflare to terminate TLS and apply the redirect).
resource "cloudflare_dns_record" "heyslate_www" {
  zone_id  = cloudflare_zone.heyslate.id
  name     = "www.heyslate.app"
  type     = "CNAME"
  content  = "${cloudflare_pages_project.slate.name}.pages.dev"
  proxied  = true
  ttl      = 1
  tags     = []
  settings = {}
}

resource "cloudflare_dns_record" "heyslate_api" {
  content = "e75d6d99-e765-434a-a8a6-6619f821ccba.cfargotunnel.com"
  name    = "api.heyslate.app"
  proxied = true
  tags    = []
  ttl     = 1
  type    = "CNAME"
  zone_id = cloudflare_zone.heyslate.id
  settings = {
    flatten_cname = false
  }
}

resource "cloudflare_ruleset" "heyslate_www_redirect" {
  zone_id = cloudflare_zone.heyslate.id
  name    = "Redirect www.heyslate.app to apex"
  kind    = "zone"
  phase   = "http_request_dynamic_redirect"

  rules = [{
    ref         = "www_to_apex"
    description = "301 www.heyslate.app/* -> heyslate.app/* (path + query preserved)"
    expression  = "(http.host eq \"www.heyslate.app\")"
    action      = "redirect"
    action_parameters = {
      from_value = {
        status_code           = 301
        preserve_query_string = true
        target_url = {
          expression = "concat(\"https://heyslate.app\", http.request.uri.path)"
        }
      }
    }
  }]
}

# Same zone-level hardening as mattrandell.com.
resource "cloudflare_bot_management" "heyslate" {
  zone_id    = cloudflare_zone.heyslate.id
  fight_mode = true
  enable_js  = true
}

resource "cloudflare_zone_setting" "heyslate_hsts" {
  zone_id    = cloudflare_zone.heyslate.id
  setting_id = "security_header"
  value = {
    strict_transport_security = {
      enabled            = true
      max_age            = 31536000
      include_subdomains = false
      preload            = false
      nosniff            = true
    }
  }
}
