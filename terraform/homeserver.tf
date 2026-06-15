resource "google_secret_manager_secret" "coolify_env" {
  secret_id = "coolify-env"
  replication {
    auto {}
  }
  depends_on = [google_project_service.secretmanager]
}
