resource "google_project_service" "domains" {
  service            = "domains.googleapis.com"
  disable_on_destroy = false
}
