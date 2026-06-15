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
