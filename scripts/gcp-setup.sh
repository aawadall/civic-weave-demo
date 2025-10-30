#!/bin/bash

# Civic Weave GCP Setup Script
# This script helps you set up a new GCP project for Civic Weave

set -e

echo "==================================="
echo "Civic Weave GCP Setup"
echo "==================================="
echo ""

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo "Error: gcloud CLI is not installed"
    echo "Please install it from: https://cloud.google.com/sdk/docs/install"
    exit 1
fi

# Check if terraform is installed
if ! command -v terraform &> /dev/null; then
    echo "Error: Terraform is not installed"
    echo "Please install it from: https://www.terraform.io/downloads"
    exit 1
fi

# Get project ID
read -p "Enter your GCP Project ID (or press Enter to create a new one): " PROJECT_ID

if [ -z "$PROJECT_ID" ]; then
    read -p "Enter a new Project ID (lowercase, numbers, hyphens only): " PROJECT_ID

    echo ""
    echo "Creating new project: $PROJECT_ID"
    gcloud projects create "$PROJECT_ID" --name="Civic Weave"
    echo "Project created successfully!"
    echo ""
    echo "IMPORTANT: You need to enable billing for this project:"
    echo "https://console.cloud.google.com/billing/linkedaccount?project=$PROJECT_ID"
    echo ""
    read -p "Press Enter after enabling billing..."
fi

# Set the project
echo "Setting active project to: $PROJECT_ID"
gcloud config set project "$PROJECT_ID"

# Get region
read -p "Enter GCP region (default: us-central1): " REGION
REGION=${REGION:-us-central1}

# Enable required APIs
echo ""
echo "Enabling required APIs..."
gcloud services enable \
    cloudrun.googleapis.com \
    sqladmin.googleapis.com \
    vpcaccess.googleapis.com \
    servicenetworking.googleapis.com \
    secretmanager.googleapis.com \
    artifactregistry.googleapis.com \
    cloudbuild.googleapis.com

echo "APIs enabled successfully!"

# Authenticate for Terraform
echo ""
echo "Setting up Terraform authentication..."
gcloud auth application-default login

# Create terraform.tfvars
echo ""
echo "Creating terraform/terraform.tfvars..."
cd terraform

cat > terraform.tfvars <<EOF
project_id   = "$PROJECT_ID"
project_name = "civic-weave"
region       = "$REGION"
environment  = "dev"

# Database configuration
db_tier = "db-f1-micro"

# Security - enable public access for development
enable_public_access = true
EOF

echo "terraform.tfvars created!"

# Initialize Terraform
echo ""
echo "Initializing Terraform..."
terraform init

echo ""
echo "==================================="
echo "Setup Complete!"
echo "==================================="
echo ""
echo "Next steps:"
echo "1. Review terraform/terraform.tfvars"
echo "2. Run: cd terraform && terraform plan"
echo "3. Run: terraform apply"
echo ""
echo "After infrastructure is created:"
echo "4. Build and push Docker images:"
echo "   cd backend && gcloud builds submit --tag $REGION-docker.pkg.dev/$PROJECT_ID/civic-weave-docker/backend:latest"
echo "   cd frontend && gcloud builds submit --tag $REGION-docker.pkg.dev/$PROJECT_ID/civic-weave-docker/frontend:latest"
echo ""
echo "5. Update terraform.tfvars with image URLs and run terraform apply again"
echo ""
