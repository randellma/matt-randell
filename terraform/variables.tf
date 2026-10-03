variable "publisher_github_repository_id" {
  description = "Immutable numeric GitHub ID of the private publishing repository. Supply through gitignored *.tfvars; do not put document IDs or credentials here."
  type        = string
  validation {
    condition     = can(regex("^[0-9]+$", var.publisher_github_repository_id))
    error_message = "The publishing repository ID must be a numeric GitHub repository ID."
  }
}

variable "publisher_github_owner_id" {
  description = "Immutable numeric GitHub ID of the publishing repository owner. Supply through gitignored *.tfvars."
  type        = string
  validation {
    condition     = can(regex("^[0-9]+$", var.publisher_github_owner_id))
    error_message = "The publishing owner ID must be a numeric GitHub owner ID."
  }
}

variable "cloudflare_api_token" {
  description = "Scoped Cloudflare API token used to manage the mattrandell.com zone, DNS records, and the discount/discount-dev tunnels. Supply via the gitignored *.tfvars or the CLOUDFLARE_API_TOKEN env var — never commit it. When null, the provider reads CLOUDFLARE_API_TOKEN from the environment."
  type        = string
  sensitive   = true
  default     = null
}
