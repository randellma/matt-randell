variable "cloudflare_api_token" {
  description = "Scoped Cloudflare API token used to manage the mattrandell.com zone, DNS records, and the discount/discount-dev tunnels. Supply via the gitignored *.tfvars or the CLOUDFLARE_API_TOKEN env var — never commit it. When null, the provider reads CLOUDFLARE_API_TOKEN from the environment."
  type        = string
  sensitive   = true
  default     = null
}
