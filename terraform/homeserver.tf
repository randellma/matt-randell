resource "google_secret_manager_secret" "coolify_env" {
  secret_id = "coolify-env"
  replication {
    auto {}
  }
  depends_on = [google_project_service.secretmanager]
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
      {
        service = "http_status:404"
      }
    ]
  }
}
