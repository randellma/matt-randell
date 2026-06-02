# Bootstrap Terraform state

**Type**: HITL
**Blocked by**: None — can start immediately

## What to build

Manually create a GCS bucket for Terraform state storage, then configure the Terraform backend to use it. This is the one-time Bootstrap step that must exist before Terraform can manage any Infrastructure.

The bucket must be created outside of Terraform (since Terraform needs it to exist before it can run). Everything else will be managed by Terraform from this point forward.

## Acceptance criteria

- [x] GCS bucket created via `gcloud storage buckets create` with versioning enabled
- [x] `terraform/backend.tf` configured to use the bucket
- [x] `terraform init` runs successfully against the GCS backend
- [x] No Terraform state committed to the repo
