# Enable GCP APIs via Terraform

**Type**: AFK
**Blocked by**: #0001 — Bootstrap Terraform state

## What to build

Enable the Cloud Domains and Cloud DNS APIs on the `matt-randell` GCP project via Terraform. This is the first `terraform apply` against the GCS backend and validates the full Infrastructure pipeline is working end-to-end.

## Acceptance criteria

- [x] `google_project_service` resources defined in Terraform for `domains.googleapis.com` and `dns.googleapis.com`
- [x] `terraform plan` shows only the expected API enablement resources
- [x] `terraform apply` succeeds with no errors
- [x] Both APIs visible as enabled in the GCP console
