terraform {
  required_version = ">= 1.9.0"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 6.0"
    }
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 5.0"
    }
  }
}

provider "google" {
  project = "matt-randell"
}

# api_token is left to var.cloudflare_api_token; when that is null the provider
# falls back to the CLOUDFLARE_API_TOKEN env var. The token is a secret — supply
# it via the gitignored *.tfvars or the env var, never in committed config.
provider "cloudflare" {
  api_token = var.cloudflare_api_token
}
