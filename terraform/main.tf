# Enable required APIs
resource "google_project_service" "required_apis" {
  for_each = toset([
    "cloudrun.googleapis.com",
    "sqladmin.googleapis.com",
    "vpcaccess.googleapis.com",
    "servicenetworking.googleapis.com",
    "secretmanager.googleapis.com",
    "artifactregistry.googleapis.com",
  ])

  service            = each.key
  disable_on_destroy = false
}

# Random suffix for unique resource names
resource "random_id" "suffix" {
  byte_length = 4
}

# Database password
resource "random_password" "db_password" {
  length  = 32
  special = true
}

# Secret Manager for database password
resource "google_secret_manager_secret" "db_password" {
  secret_id = "${var.project_name}-db-password-${random_id.suffix.hex}"

  replication {
    auto {}
  }

  depends_on = [google_project_service.required_apis]
}

resource "google_secret_manager_secret_version" "db_password" {
  secret      = google_secret_manager_secret.db_password.id
  secret_data = random_password.db_password.result
}

# Cloud SQL Instance
resource "google_sql_database_instance" "main" {
  name             = "${var.project_name}-db-${random_id.suffix.hex}"
  database_version = "POSTGRES_15"
  region           = var.region

  deletion_protection = false # Set to true in production

  settings {
    tier              = var.db_tier
    availability_type = "ZONAL" # Use "REGIONAL" for production
    disk_size         = 10
    disk_type         = "PD_SSD"

    backup_configuration {
      enabled            = true
      start_time         = "03:00"
      point_in_time_recovery_enabled = false
    }

    ip_configuration {
      ipv4_enabled    = true # Change to false for production with VPC
      private_network = null # Configure VPC for production
    }

    database_flags {
      name  = "max_connections"
      value = "100"
    }
  }

  depends_on = [google_project_service.required_apis]
}

# Database
resource "google_sql_database" "database" {
  name     = "civic_weave"
  instance = google_sql_database_instance.main.name
}

# Database user
resource "google_sql_user" "user" {
  name     = "civic_weave_user"
  instance = google_sql_database_instance.main.name
  password = random_password.db_password.result
}

# Service account for Cloud Run
resource "google_service_account" "cloudrun" {
  account_id   = "${var.project_name}-cloudrun-${random_id.suffix.hex}"
  display_name = "Cloud Run Service Account"
}

# IAM bindings for service account
resource "google_project_iam_member" "cloudrun_sql" {
  project = var.project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${google_service_account.cloudrun.email}"
}

resource "google_secret_manager_secret_iam_member" "cloudrun_secrets" {
  secret_id = google_secret_manager_secret.db_password.id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.cloudrun.email}"
}

# Backend Cloud Run Service
resource "google_cloud_run_v2_service" "backend" {
  name     = "${var.project_name}-backend"
  location = var.region

  template {
    service_account = google_service_account.cloudrun.email

    containers {
      image = var.backend_image

      env {
        name  = "DB_HOST"
        value = google_sql_database_instance.main.private_ip_address != "" ? google_sql_database_instance.main.private_ip_address : google_sql_database_instance.main.public_ip_address
      }

      env {
        name  = "DB_PORT"
        value = "5432"
      }

      env {
        name  = "DB_NAME"
        value = google_sql_database.database.name
      }

      env {
        name  = "DB_USER"
        value = google_sql_user.user.name
      }

      env {
        name = "DB_PASSWORD"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.db_password.secret_id
            version = "latest"
          }
        }
      }

      env {
        name  = "PORT"
        value = "8080"
      }

      resources {
        limits = {
          cpu    = "1"
          memory = "512Mi"
        }
      }
    }

    scaling {
      min_instance_count = 0
      max_instance_count = 10
    }
  }

  depends_on = [
    google_project_service.required_apis,
    google_sql_database.database,
  ]
}

# Frontend Cloud Run Service
resource "google_cloud_run_v2_service" "frontend" {
  name     = "${var.project_name}-frontend"
  location = var.region

  template {
    service_account = google_service_account.cloudrun.email

    containers {
      image = var.frontend_image

      env {
        name  = "BACKEND_URL"
        value = google_cloud_run_v2_service.backend.uri
      }

      resources {
        limits = {
          cpu    = "1"
          memory = "256Mi"
        }
      }
    }

    scaling {
      min_instance_count = 0
      max_instance_count = 10
    }
  }

  depends_on = [google_project_service.required_apis]
}

# IAM policy to allow unauthenticated access (for development)
resource "google_cloud_run_v2_service_iam_member" "backend_public" {
  count = var.enable_public_access ? 1 : 0

  location = google_cloud_run_v2_service.backend.location
  name     = google_cloud_run_v2_service.backend.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

resource "google_cloud_run_v2_service_iam_member" "frontend_public" {
  count = var.enable_public_access ? 1 : 0

  location = google_cloud_run_v2_service.frontend.location
  name     = google_cloud_run_v2_service.frontend.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# Artifact Registry for Docker images
resource "google_artifact_registry_repository" "docker" {
  location      = var.region
  repository_id = "${var.project_name}-docker"
  description   = "Docker repository for Civic Weave"
  format        = "DOCKER"

  depends_on = [google_project_service.required_apis]
}
