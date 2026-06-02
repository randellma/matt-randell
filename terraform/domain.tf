resource "google_clouddomains_registration" "mattrandell_com" {
  domain_name = "mattrandell.com"
  location    = "global"

  yearly_price {
    currency_code = "USD"
    units         = "12"
  }

  contact_settings {
    privacy = "PRIVATE_CONTACT_DATA"

    registrant_contact {
      email        = "randellma@gmail.com"
      phone_number = "+12266980180"
      postal_address {
        region_code         = "CA"
        administrative_area = "ON"
        locality            = "Kitchener"
        postal_code         = "N2E 2Z5"
        address_lines       = ["74 The Country Way"]
        recipients          = ["Matthew Randell"]
      }
    }

    admin_contact {
      email        = "randellma@gmail.com"
      phone_number = "+12266980180"
      postal_address {
        region_code         = "CA"
        administrative_area = "ON"
        locality            = "Kitchener"
        postal_code         = "N2E 2Z5"
        address_lines       = ["74 The Country Way"]
        recipients          = ["Matthew Randell"]
      }
    }

    technical_contact {
      email        = "randellma@gmail.com"
      phone_number = "+12266980180"
      postal_address {
        region_code         = "CA"
        administrative_area = "ON"
        locality            = "Kitchener"
        postal_code         = "N2E 2Z5"
        address_lines       = ["74 The Country Way"]
        recipients          = ["Matthew Randell"]
      }
    }
  }

  dns_settings {
    custom_dns {
      name_servers = google_dns_managed_zone.mattrandell_com.name_servers
    }
  }

  management_settings {
    preferred_renewal_method = "AUTOMATIC_RENEWAL"
    transfer_lock_state      = "LOCKED"
  }

  lifecycle {
    prevent_destroy = true
    ignore_changes  = [yearly_price]
  }

  depends_on = [google_project_service.domains]
}
