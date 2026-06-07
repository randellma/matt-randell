resource "google_dns_managed_zone" "mattrandell_com" {
  name       = "mattrandell-com"
  dns_name   = "mattrandell.com."
  visibility = "public"

  depends_on = [google_project_service.dns]
}

resource "google_dns_record_set" "apex_a" {
  name         = "mattrandell.com."
  type         = "A"
  ttl          = 300
  managed_zone = google_dns_managed_zone.mattrandell_com.name

  rrdatas = [
    "185.199.108.153",
    "185.199.109.153",
    "185.199.110.153",
    "185.199.111.153",
  ]
}

resource "google_dns_record_set" "apex_aaaa" {
  name         = "mattrandell.com."
  type         = "AAAA"
  ttl          = 300
  managed_zone = google_dns_managed_zone.mattrandell_com.name

  rrdatas = [
    "2606:50c0:8000::153",
    "2606:50c0:8001::153",
    "2606:50c0:8002::153",
    "2606:50c0:8003::153",
  ]
}

resource "google_dns_record_set" "www_cname" {
  name         = "www.mattrandell.com."
  type         = "CNAME"
  ttl          = 300
  managed_zone = google_dns_managed_zone.mattrandell_com.name

  rrdatas = ["randellma.github.io."]
}

resource "google_dns_record_set" "send_mx" {
  name         = "send.mattrandell.com."
  type         = "MX"
  ttl          = 300
  managed_zone = google_dns_managed_zone.mattrandell_com.name

  rrdatas = ["10 feedback-smtp.us-east-1.amazonses.com."]
}

resource "google_dns_record_set" "send_spf_txt" {
  name         = "send.mattrandell.com."
  type         = "TXT"
  ttl          = 300
  managed_zone = google_dns_managed_zone.mattrandell_com.name

  rrdatas = ["\"v=spf1 include:amazonses.com ~all\""]
}

resource "google_dns_record_set" "dmarc_txt" {
  name         = "_dmarc.mattrandell.com."
  type         = "TXT"
  ttl          = 300
  managed_zone = google_dns_managed_zone.mattrandell_com.name

  rrdatas = ["\"v=DMARC1; p=none;\""]
}

resource "google_dns_record_set" "resend_dkim_txt" {
  name         = "resend._domainkey.mattrandell.com."
  type         = "TXT"
  ttl          = 300
  managed_zone = google_dns_managed_zone.mattrandell_com.name

  rrdatas = ["\"p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC7iKanH/Wt7su2YSU9PmQI5FWIXVcF9bhPtmLOKsOc6xuicMk44CrjYclZOlXIkafHInjkT2iln/4T9cgyxDmGKSqHaA9V5ldn9HDYOGPQKepjgul6xWQlk/LuoUwQWi12+GFBrnsMZWguAqAdY+KyZgBBTurg2Sd7iAaWR/q35QIDAQAB\""]
}

resource "google_dns_record_set" "discount_cname" {
  name         = "discount.mattrandell.com."
  type         = "CNAME"
  ttl          = 300
  managed_zone = google_dns_managed_zone.mattrandell_com.name

  rrdatas = ["e75d6d99-e765-434a-a8a6-6619f821ccba.cfargotunnel.com."]
}

resource "google_dns_record_set" "discount_dev_cname" {
  name         = "discount-dev.mattrandell.com."
  type         = "CNAME"
  ttl          = 300
  managed_zone = google_dns_managed_zone.mattrandell_com.name

  rrdatas = ["5986a706-c2c7-4be1-8762-5d602419c423.cfargotunnel.com."]
}

output "nameservers" {
  description = "Cloud DNS nameservers for mattrandell.com — needed for domain transfer in issue #0004"
  value       = google_dns_managed_zone.mattrandell_com.name_servers
}
