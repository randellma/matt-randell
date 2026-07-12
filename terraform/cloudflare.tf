resource "cloudflare_zone" "terraform_managed_resource_cb009dc3da4929bf68ef21b73d4552f1_0" {
  name                = "mattrandell.com"
  paused              = false
  type                = "full"
  vanity_name_servers = []
  account = {
    id   = "894ff489298bdf1ca445fc9469854b25"
    name = "Randellma@gmail.com's Account"
  }
}

resource "cloudflare_dns_record" "terraform_managed_resource_d5976c6a6e9c0c2eea2aaeceeef258ee_0" {
  content  = "185.199.110.153"
  name     = "mattrandell.com"
  proxied  = true
  tags     = []
  ttl      = 1
  type     = "A"
  zone_id  = "cb009dc3da4929bf68ef21b73d4552f1"
  settings = {}
}

resource "cloudflare_dns_record" "terraform_managed_resource_bfcee40d50d911c0f2853a9a011fc891_1" {
  content  = "185.199.111.153"
  name     = "mattrandell.com"
  proxied  = true
  tags     = []
  ttl      = 1
  type     = "A"
  zone_id  = "cb009dc3da4929bf68ef21b73d4552f1"
  settings = {}
}

resource "cloudflare_dns_record" "terraform_managed_resource_e504c3bf9c999548760f317d7a84c258_2" {
  content  = "185.199.108.153"
  name     = "mattrandell.com"
  proxied  = true
  tags     = []
  ttl      = 1
  type     = "A"
  zone_id  = "cb009dc3da4929bf68ef21b73d4552f1"
  settings = {}
}

resource "cloudflare_dns_record" "terraform_managed_resource_0faea5a771cc40c0487527174aee1053_3" {
  content  = "185.199.109.153"
  name     = "mattrandell.com"
  proxied  = true
  tags     = []
  ttl      = 1
  type     = "A"
  zone_id  = "cb009dc3da4929bf68ef21b73d4552f1"
  settings = {}
}

resource "cloudflare_dns_record" "terraform_managed_resource_cf9911eb3452304222286f2dff99be29_4" {
  content  = "2606:50c0:8003::153"
  name     = "mattrandell.com"
  proxied  = true
  tags     = []
  ttl      = 1
  type     = "AAAA"
  zone_id  = "cb009dc3da4929bf68ef21b73d4552f1"
  settings = {}
}

resource "cloudflare_dns_record" "terraform_managed_resource_42bec47861055b21d74685377fbb1c53_5" {
  content  = "2606:50c0:8002::153"
  name     = "mattrandell.com"
  proxied  = true
  tags     = []
  ttl      = 1
  type     = "AAAA"
  zone_id  = "cb009dc3da4929bf68ef21b73d4552f1"
  settings = {}
}

resource "cloudflare_dns_record" "terraform_managed_resource_372919df3eddc4363f1899bf76435793_6" {
  content  = "2606:50c0:8001::153"
  name     = "mattrandell.com"
  proxied  = true
  tags     = []
  ttl      = 1
  type     = "AAAA"
  zone_id  = "cb009dc3da4929bf68ef21b73d4552f1"
  settings = {}
}

resource "cloudflare_dns_record" "terraform_managed_resource_c8f861ace31bfc1e3119826c56c781b5_7" {
  content  = "2606:50c0:8000::153"
  name     = "mattrandell.com"
  proxied  = true
  tags     = []
  ttl      = 1
  type     = "AAAA"
  zone_id  = "cb009dc3da4929bf68ef21b73d4552f1"
  settings = {}
}

resource "cloudflare_dns_record" "terraform_managed_resource_d5e85d6546c182cb0367e07933eff468_9" {
  content = "e75d6d99-e765-434a-a8a6-6619f821ccba.cfargotunnel.com"
  name    = "discount.mattrandell.com"
  proxied = true
  tags    = []
  ttl     = 1
  type    = "CNAME"
  zone_id = "cb009dc3da4929bf68ef21b73d4552f1"
  settings = {
    flatten_cname = false
  }
}

resource "cloudflare_dns_record" "terraform_managed_resource_16b7f23ea7edd7a9632169d1d46103df_10" {
  content = "randellma.github.io"
  name    = "www.mattrandell.com"
  proxied = true
  tags    = []
  ttl     = 1
  type    = "CNAME"
  zone_id = "cb009dc3da4929bf68ef21b73d4552f1"
  settings = {
    flatten_cname = false
  }
}

resource "cloudflare_dns_record" "terraform_managed_resource_2c004e6a09f5fe548dd107e691bdf0af_11" {
  content  = "feedback-smtp.us-east-1.amazonses.com"
  name     = "send.mattrandell.com"
  priority = 10
  proxied  = false
  tags     = []
  ttl      = 1
  type     = "MX"
  zone_id  = "cb009dc3da4929bf68ef21b73d4552f1"
  settings = {}
}

resource "cloudflare_dns_record" "terraform_managed_resource_f97b6cfc063a35e31871d5affc7ecd3f_12" {
  content  = "ns.phx4.nearlyfreespeech.net"
  name     = "mattrandell.com"
  proxied  = false
  tags     = []
  ttl      = 1
  type     = "NS"
  zone_id  = "cb009dc3da4929bf68ef21b73d4552f1"
  settings = {}
}

resource "cloudflare_dns_record" "terraform_managed_resource_64dd71deee2e20a31f6ec0c543ab5a82_13" {
  content  = "ns.phx6.nearlyfreespeech.net"
  name     = "mattrandell.com"
  proxied  = false
  tags     = []
  ttl      = 1
  type     = "NS"
  zone_id  = "cb009dc3da4929bf68ef21b73d4552f1"
  settings = {}
}

resource "cloudflare_dns_record" "terraform_managed_resource_866220203fc89d8588bfd6476a75306c_14" {
  content  = "\"v=DMARC1; p=none;\""
  name     = "_dmarc.mattrandell.com"
  proxied  = false
  tags     = []
  ttl      = 1
  type     = "TXT"
  zone_id  = "cb009dc3da4929bf68ef21b73d4552f1"
  settings = {}
}

resource "cloudflare_dns_record" "terraform_managed_resource_dac20960e65a6fff19d99d253b026749_15" {
  content  = "\"p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC7iKanH/Wt7su2YSU9PmQI5FWIXVcF9bhPtmLOKsOc6xuicMk44CrjYclZOlXIkafHInjkT2iln/4T9cgyxDmGKSqHaA9V5ldn9HDYOGPQKepjgul6xWQlk/LuoUwQWi12+GFBrnsMZWguAqAdY+KyZgBBTurg2Sd7iAaWR/q35QIDAQAB\""
  name     = "resend._domainkey.mattrandell.com"
  proxied  = false
  tags     = []
  ttl      = 1
  type     = "TXT"
  zone_id  = "cb009dc3da4929bf68ef21b73d4552f1"
  settings = {}
}

resource "cloudflare_dns_record" "terraform_managed_resource_85b4514c40d468c358b63aa76259ba7e_16" {
  content  = "\"v=spf1 include:amazonses.com ~all\""
  name     = "send.mattrandell.com"
  proxied  = false
  tags     = []
  ttl      = 1
  type     = "TXT"
  zone_id  = "cb009dc3da4929bf68ef21b73d4552f1"
  settings = {}
}

resource "cloudflare_zero_trust_tunnel_cloudflared" "terraform_managed_resource_e75d6d99-e765-434a-a8a6-6619f821ccba_1" {
  account_id = "894ff489298bdf1ca445fc9469854b25"
  config_src = "cloudflare"
  name       = "discount-web-app"
}

resource "cloudflare_dns_record" "inventory_api" {
  content = "e75d6d99-e765-434a-a8a6-6619f821ccba.cfargotunnel.com"
  name    = "inventory-api.mattrandell.com"
  proxied = true
  tags    = []
  ttl     = 1
  type    = "CNAME"
  zone_id = "cb009dc3da4929bf68ef21b73d4552f1"
  settings = {
    flatten_cname = false
  }
}

resource "cloudflare_dns_record" "divvy_api" {
  content = "e75d6d99-e765-434a-a8a6-6619f821ccba.cfargotunnel.com"
  name    = "divvy-api.mattrandell.com"
  proxied = true
  tags    = []
  ttl     = 1
  type    = "CNAME"
  zone_id = "cb009dc3da4929bf68ef21b73d4552f1"
  settings = {
    flatten_cname = false
  }
}

resource "cloudflare_dns_record" "coolify" {
  content = "e75d6d99-e765-434a-a8a6-6619f821ccba.cfargotunnel.com"
  name    = "coolify.mattrandell.com"
  proxied = true
  tags    = []
  ttl     = 1
  type    = "CNAME"
  zone_id = "cb009dc3da4929bf68ef21b73d4552f1"
  settings = {
    flatten_cname = false
  }
}

resource "cloudflare_bot_management" "mattrandell" {
  zone_id    = "cb009dc3da4929bf68ef21b73d4552f1"
  fight_mode = true
  enable_js  = true
}

resource "cloudflare_zone_setting" "hsts" {
  zone_id     = "cb009dc3da4929bf68ef21b73d4552f1"
  setting_id  = "security_header"
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

# Divvy → Slate rebrand: 301-redirect every divvy.mattrandell.com request to
# the same path on slate.mattrandell.com, so existing share links
# (divvy.mattrandell.com/g/<id>/<token>) and bookmarks keep working. Dynamic
# redirects run before Pages serves the divvy custom domain, so the divvy Pages
# project (kept in cloudflare_pages.tf) simply stops receiving traffic. The
# backend host divvy-api.mattrandell.com is intentionally NOT redirected —
# installed PWAs still call it directly.
resource "cloudflare_ruleset" "divvy_to_slate_redirect" {
  zone_id = "cb009dc3da4929bf68ef21b73d4552f1"
  name    = "Redirect divvy.mattrandell.com to slate.mattrandell.com"
  kind    = "zone"
  phase   = "http_request_dynamic_redirect"

  rules = [{
    ref         = "divvy_to_slate"
    description = "301 divvy.mattrandell.com/* -> slate.mattrandell.com/* (path + query preserved)"
    expression  = "(http.host eq \"divvy.mattrandell.com\")"
    action      = "redirect"
    action_parameters = {
      from_value = {
        status_code           = 301
        preserve_query_string = true
        target_url = {
          expression = "concat(\"https://slate.mattrandell.com\", http.request.uri.path)"
        }
      }
    }
  }]
}


