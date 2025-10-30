variable "project_id" {
  description = "GCP Project ID"
  type        = string
}

variable "project_name" {
  description = "Human-readable project name"
  type        = string
  default     = "civic-weave"
}

variable "region" {
  description = "GCP region"
  type        = string
  default     = "us-central1"
}

variable "environment" {
  description = "Environment (dev, staging, prod)"
  type        = string
  default     = "dev"
}

variable "backend_image" {
  description = "Docker image for backend (e.g., gcr.io/PROJECT_ID/backend:latest)"
  type        = string
  default     = "gcr.io/cloudrun/hello" # Placeholder until first deployment
}

variable "frontend_image" {
  description = "Docker image for frontend (e.g., gcr.io/PROJECT_ID/frontend:latest)"
  type        = string
  default     = "gcr.io/cloudrun/hello" # Placeholder until first deployment
}

variable "db_tier" {
  description = "Cloud SQL tier"
  type        = string
  default     = "db-f1-micro"
}

variable "enable_public_access" {
  description = "Enable public access to services (set to false for production)"
  type        = bool
  default     = true
}
