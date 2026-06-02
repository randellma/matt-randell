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

resource "google_dns_record_set" "www_cname" {
  name         = "www.mattrandell.com."
  type         = "CNAME"
  ttl          = 300
  managed_zone = google_dns_managed_zone.mattrandell_com.name

  rrdatas = ["randellma.github.io."]
}

output "nameservers" {
  description = "Cloud DNS nameservers for mattrandell.com — needed for domain transfer in issue #0004"
  value       = google_dns_managed_zone.mattrandell_com.name_servers
}
