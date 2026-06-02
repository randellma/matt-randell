mock_provider "google" {
  mock_resource "google_dns_managed_zone" {
    defaults = {
      name_servers = ["ns-cloud-a1.googledomains.com.", "ns-cloud-a2.googledomains.com.", "ns-cloud-a3.googledomains.com.", "ns-cloud-a4.googledomains.com."]
    }
  }
}

run "dns_zone_created_for_mattrandell_com" {
  command = plan

  assert {
    condition     = google_dns_managed_zone.mattrandell_com.dns_name == "mattrandell.com."
    error_message = "DNS zone must use dns_name 'mattrandell.com.'"
  }

  assert {
    condition     = google_dns_managed_zone.mattrandell_com.visibility == "public"
    error_message = "DNS zone must be public"
  }
}

run "apex_a_records_point_to_github_pages" {
  command = plan

  assert {
    condition     = google_dns_record_set.apex_a.type == "A"
    error_message = "Apex record set must be type A"
  }

  assert {
    condition     = contains(toset(google_dns_record_set.apex_a.rrdatas), "185.199.108.153")
    error_message = "A records must include GitHub Pages IP 185.199.108.153"
  }

  assert {
    condition     = contains(toset(google_dns_record_set.apex_a.rrdatas), "185.199.109.153")
    error_message = "A records must include GitHub Pages IP 185.199.109.153"
  }

  assert {
    condition     = contains(toset(google_dns_record_set.apex_a.rrdatas), "185.199.110.153")
    error_message = "A records must include GitHub Pages IP 185.199.110.153"
  }

  assert {
    condition     = contains(toset(google_dns_record_set.apex_a.rrdatas), "185.199.111.153")
    error_message = "A records must include GitHub Pages IP 185.199.111.153"
  }
}

run "www_cname_points_to_github_pages" {
  command = plan

  assert {
    condition     = google_dns_record_set.www_cname.type == "CNAME"
    error_message = "www record set must be type CNAME"
  }

  assert {
    condition     = contains(toset(google_dns_record_set.www_cname.rrdatas), "randellma.github.io.")
    error_message = "www CNAME must point to randellma.github.io."
  }

  assert {
    condition     = google_dns_record_set.www_cname.name == "www.mattrandell.com."
    error_message = "www CNAME name must be www.mattrandell.com."
  }
}

