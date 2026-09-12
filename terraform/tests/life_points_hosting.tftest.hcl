mock_provider "google" {}
mock_provider "cloudflare" {}

run "life_points_frontend_uses_cloudflare_pages" {
  command = plan

  assert {
    condition     = cloudflare_pages_project.life_points.name == "life-points-mattrandell"
    error_message = "Life Points must have its own Cloudflare Pages project."
  }

  assert {
    condition     = cloudflare_pages_domain.life_points.name == "lifepoints.mattrandell.com"
    error_message = "The Life Points PWA must use its isolated production origin."
  }

  assert {
    condition     = cloudflare_dns_record.life_points.content == "life-points-mattrandell.pages.dev"
    error_message = "The Life Points frontend DNS record must point to its Pages project."
  }
}

run "life_points_api_uses_the_shared_home_server_tunnel" {
  command = plan

  assert {
    condition     = cloudflare_dns_record.life_points_api.content == "e75d6d99-e765-434a-a8a6-6619f821ccba.cfargotunnel.com"
    error_message = "The Life Points API DNS record must point to the shared Home Server tunnel."
  }

  assert {
    condition = anytrue([
      for route in cloudflare_zero_trust_tunnel_cloudflared_config.homeserver.config.ingress :
      try(route.hostname == "lifepoints-api.mattrandell.com" && route.origin_request.origin_server_name == "lifepoints-api.mattrandell.com", false)
    ])
    error_message = "The shared tunnel must route Life Points API traffic with the correct TLS SNI."
  }
}
