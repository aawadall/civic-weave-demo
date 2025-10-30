output "project_id" {
  description = "GCP Project ID"
  value       = var.project_id
}

output "region" {
  description = "GCP Region"
  value       = var.region
}

output "backend_url" {
  description = "Backend Cloud Run URL"
  value       = google_cloud_run_v2_service.backend.uri
}

output "frontend_url" {
  description = "Frontend Cloud Run URL"
  value       = google_cloud_run_v2_service.frontend.uri
}

output "database_instance" {
  description = "Cloud SQL instance name"
  value       = google_sql_database_instance.main.name
}

output "database_connection_name" {
  description = "Cloud SQL connection name"
  value       = google_sql_database_instance.main.connection_name
}

output "database_public_ip" {
  description = "Database public IP address"
  value       = google_sql_database_instance.main.public_ip_address
}

output "artifact_registry_url" {
  description = "Artifact Registry URL"
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.docker.repository_id}"
}

output "service_account_email" {
  description = "Cloud Run service account email"
  value       = google_service_account.cloudrun.email
}

output "db_password_secret" {
  description = "Secret Manager secret ID for database password"
  value       = google_secret_manager_secret.db_password.secret_id
  sensitive   = true
}
