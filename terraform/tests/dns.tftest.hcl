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

run "apex_aaaa_records_point_to_github_pages" {
  command = plan

  assert {
    condition     = google_dns_record_set.apex_aaaa.type == "AAAA"
    error_message = "Apex AAAA record set must be type AAAA"
  }

  assert {
    condition     = contains(toset(google_dns_record_set.apex_aaaa.rrdatas), "2606:50c0:8000::153")
    error_message = "AAAA records must include GitHub Pages IPv6 2606:50c0:8000::153"
  }

  assert {
    condition     = contains(toset(google_dns_record_set.apex_aaaa.rrdatas), "2606:50c0:8001::153")
    error_message = "AAAA records must include GitHub Pages IPv6 2606:50c0:8001::153"
  }

  assert {
    condition     = contains(toset(google_dns_record_set.apex_aaaa.rrdatas), "2606:50c0:8002::153")
    error_message = "AAAA records must include GitHub Pages IPv6 2606:50c0:8002::153"
  }

  assert {
    condition     = contains(toset(google_dns_record_set.apex_aaaa.rrdatas), "2606:50c0:8003::153")
    error_message = "AAAA records must include GitHub Pages IPv6 2606:50c0:8003::153"
  }
}

run "cloudflare_tunnel_cnames_present" {
  command = plan

  assert {
    condition     = google_dns_record_set.discount_cname.type == "CNAME"
    error_message = "discount CNAME must be type CNAME"
  }

  assert {
    condition     = contains(toset(google_dns_record_set.discount_cname.rrdatas), "e75d6d99-e765-434a-a8a6-6619f821ccba.cfargotunnel.com.")
    error_message = "discount CNAME must point to its Argo Tunnel endpoint"
  }

  assert {
    condition     = google_dns_record_set.discount_dev_cname.type == "CNAME"
    error_message = "discount-dev CNAME must be type CNAME"
  }

  assert {
    condition     = contains(toset(google_dns_record_set.discount_dev_cname.rrdatas), "5986a706-c2c7-4be1-8762-5d602419c423.cfargotunnel.com.")
    error_message = "discount-dev CNAME must point to its Argo Tunnel endpoint"
  }
}

run "email_records_present" {
  command = plan

  assert {
    condition     = google_dns_record_set.send_mx.type == "MX"
    error_message = "send MX record must be type MX"
  }

  assert {
    condition     = contains(toset(google_dns_record_set.send_mx.rrdatas), "10 feedback-smtp.us-east-1.amazonses.com.")
    error_message = "send MX must route through Amazon SES"
  }

  assert {
    condition     = google_dns_record_set.send_spf_txt.type == "TXT"
    error_message = "send SPF record must be type TXT"
  }

  assert {
    condition     = contains(toset(google_dns_record_set.send_spf_txt.rrdatas), "\"v=spf1 include:amazonses.com ~all\"")
    error_message = "send SPF must authorize Amazon SES"
  }

  assert {
    condition     = google_dns_record_set.dmarc_txt.type == "TXT"
    error_message = "DMARC record must be type TXT"
  }

  assert {
    condition     = google_dns_record_set.resend_dkim_txt.type == "TXT"
    error_message = "DKIM record must be type TXT"
  }
}

