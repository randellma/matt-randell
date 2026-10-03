output "publisher_service_account" {
  description = "Share each existing human-owned Drive publication with this identity as Editor."
  value       = google_service_account.publisher.email
}

output "publisher_workload_identity_provider" {
  description = "Workload identity provider resource name for the external repository's GitHub Actions authentication."
  value       = google_iam_workload_identity_pool_provider.publisher_github.name
}

output "coolify_backup_access_key_id" {
  description = "HMAC access key ID for Coolify → GCS backup (S3-compatible)"
  value       = google_storage_hmac_key.coolify_backup.access_id
  sensitive   = false
}

output "coolify_backup_secret" {
  description = "HMAC secret for Coolify → GCS backup — treat as a password"
  value       = google_storage_hmac_key.coolify_backup.secret
  sensitive   = true
}

output "coolify_backup_bucket" {
  description = "GCS bucket name for Coolify backups"
  value       = google_storage_bucket.coolify_backup.name
  sensitive   = false
}
