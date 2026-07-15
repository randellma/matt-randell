resource "google_secret_manager_secret" "coolify_env" {
  secret_id = "coolify-env"
  replication {
    auto {}
  }
  depends_on = [google_project_service.secretmanager]
}

resource "google_service_account" "coolify_backup" {
  account_id   = "coolify-backup"
  display_name = "Coolify Backup"
  depends_on   = [google_project_service.iam]
}

resource "google_storage_bucket" "coolify_backup" {
  name          = "matt-randell-coolify-backups"
  location      = "US"
  force_destroy = false
  depends_on    = [google_project_service.storage]

  lifecycle_rule {
    condition { age = 30 }
    action { type = "Delete" }
  }
}

resource "google_storage_bucket_iam_member" "coolify_backup" {
  bucket = google_storage_bucket.coolify_backup.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.coolify_backup.email}"
}

resource "google_storage_hmac_key" "coolify_backup" {
  service_account_email = google_service_account.coolify_backup.email
  depends_on            = [google_project_service.storage]
}

resource "cloudflare_zero_trust_tunnel_cloudflared_config" "homeserver" {
  account_id = "894ff489298bdf1ca445fc9469854b25"
  tunnel_id  = "e75d6d99-e765-434a-a8a6-6619f821ccba"

  config = {
    ingress = [
      {
        hostname = "coolify.mattrandell.com"
        service  = "http://localhost:8000"
      },
      {
        hostname = "discount.mattrandell.com"
        service  = "http://localhost:3000"
      },
      # Coolify apps behind Traefik route through its HTTPS entrypoint (443),
      # not port 80 (Traefik redirects http->https, causing a loop with the
      # tunnel) or 8080 (Traefik's dashboard/API, not app routing). Traefik
      # picks the router by TLS SNI, so origin_server_name must be set to the
      # real hostname (cloudflared otherwise sends "localhost" as SNI, which
      # matches no router and the connection is just dropped -> bare 502).
      {
        hostname = "inventory-api.mattrandell.com"
        service  = "https://localhost:443"
        origin_request = {
          no_tls_verify      = true
          origin_server_name = "inventory-api.mattrandell.com"
        }
      },
      # Slate's PocketBase answers on two hostnames: api.heyslate.app (current)
      # and divvy-api.mattrandell.com (kept so installed PWAs pinned to the old
      # origin keep working). Both must be added as domains on the Coolify app
      # so Traefik has a router for each SNI.
      {
        hostname = "divvy-api.mattrandell.com"
        service  = "https://localhost:443"
        origin_request = {
          no_tls_verify      = true
          origin_server_name = "divvy-api.mattrandell.com"
        }
      },
      {
        hostname = "api.heyslate.app"
        service  = "https://localhost:443"
        origin_request = {
          no_tls_verify      = true
          origin_server_name = "api.heyslate.app"
        }
      },
      {
        service = "http_status:404"
      }
    ]
  }
}
