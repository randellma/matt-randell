mock_provider "google" {
  mock_resource "google_dns_managed_zone" {
    defaults = {
      name_servers = ["ns-cloud-d1.googledomains.com.", "ns-cloud-d2.googledomains.com.", "ns-cloud-d3.googledomains.com.", "ns-cloud-d4.googledomains.com."]
    }
  }
}

run "registration_targets_correct_domain" {
  command = plan

  assert {
    condition     = google_clouddomains_registration.mattrandell_com.domain_name == "mattrandell.com"
    error_message = "domain_name must be mattrandell.com"
  }

  assert {
    condition     = google_clouddomains_registration.mattrandell_com.location == "global"
    error_message = "location must be global"
  }
}

run "contact_privacy_is_private" {
  command = plan

  assert {
    condition     = google_clouddomains_registration.mattrandell_com.contact_settings[0].privacy == "PRIVATE_CONTACT_DATA"
    error_message = "contact privacy must be PRIVATE_CONTACT_DATA to shield personal info from WHOIS"
  }
}

run "registrant_contact_details_correct" {
  command = plan

  assert {
    condition     = google_clouddomains_registration.mattrandell_com.contact_settings[0].registrant_contact[0].email == "randellma@gmail.com"
    error_message = "registrant email must be randellma@gmail.com"
  }

  assert {
    condition     = google_clouddomains_registration.mattrandell_com.contact_settings[0].registrant_contact[0].phone_number == "+12266980180"
    error_message = "registrant phone must be +12266980180 (E.164)"
  }

  assert {
    condition     = google_clouddomains_registration.mattrandell_com.contact_settings[0].registrant_contact[0].postal_address[0].locality == "Kitchener"
    error_message = "registrant city must be Kitchener"
  }

  assert {
    condition     = google_clouddomains_registration.mattrandell_com.contact_settings[0].registrant_contact[0].postal_address[0].region_code == "CA"
    error_message = "registrant country code must be CA"
  }
}

run "dns_uses_custom_dns_not_google_domains" {
  command = plan

  assert {
    condition     = length(google_clouddomains_registration.mattrandell_com.dns_settings[0].custom_dns) > 0
    error_message = "registration must use custom_dns (Cloud DNS zone), not google_domains_dns"
  }
}

run "management_settings_auto_renew_and_locked" {
  command = plan

  assert {
    condition     = google_clouddomains_registration.mattrandell_com.management_settings[0].preferred_renewal_method == "AUTOMATIC_RENEWAL"
    error_message = "preferred_renewal_method must be AUTOMATIC_RENEWAL to prevent accidental expiry"
  }

  assert {
    condition     = google_clouddomains_registration.mattrandell_com.management_settings[0].transfer_lock_state == "LOCKED"
    error_message = "transfer_lock_state must be LOCKED (60-day re-transfer lock per ADR-0002)"
  }
}
