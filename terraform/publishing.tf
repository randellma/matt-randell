# Keyless identity for an external private repository's publishing workflow.
# File access is granted separately in Drive, never through project-wide IAM.
resource "google_project_service" "drive" {
  service            = "drive.googleapis.com"
  disable_on_destroy = false
}

resource "google_project_service" "iamcredentials" {
  service            = "iamcredentials.googleapis.com"
  disable_on_destroy = false
}

resource "google_project_service" "sts" {
  service            = "sts.googleapis.com"
  disable_on_destroy = false
}

resource "google_service_account" "publisher" {
  account_id   = "household-publisher"
  display_name = "Household document publisher"
  description  = "Updates existing human-owned Drive files shared with this identity; no keys or project resource roles."
  depends_on   = [google_project_service.iam]
}

resource "google_iam_workload_identity_pool" "publisher" {
  workload_identity_pool_id = "document-publishing"
  display_name              = "Document publishing"
  description               = "GitHub OIDC trust for the external publishing repository."
  depends_on                = [google_project_service.iam, google_project_service.sts]
}

resource "google_iam_workload_identity_pool_provider" "publisher_github" {
  workload_identity_pool_id          = google_iam_workload_identity_pool.publisher.workload_identity_pool_id
  workload_identity_pool_provider_id = "github"
  display_name                       = "GitHub main publishing"
  attribute_mapping = {
    "google.subject"                = "assertion.sub"
    "attribute.repository_id"       = "assertion.repository_id"
    "attribute.repository_owner_id" = "assertion.repository_owner_id"
    "attribute.ref"                 = "assertion.ref"
  }
  attribute_condition = join(" && ", [
    "assertion.repository_id == '${var.publisher_github_repository_id}'",
    "assertion.repository_owner_id == '${var.publisher_github_owner_id}'",
    "assertion.ref == 'refs/heads/main'",
    "assertion.event_name in ['push', 'workflow_dispatch']",
  ])
  oidc {
    issuer_uri = "https://token.actions.githubusercontent.com"
  }
}

resource "google_service_account_iam_member" "publisher_github" {
  service_account_id = google_service_account.publisher.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/${google_iam_workload_identity_pool.publisher.name}/attribute.repository_id/${var.publisher_github_repository_id}"
  depends_on         = [google_iam_workload_identity_pool_provider.publisher_github, google_project_service.iamcredentials]
}
