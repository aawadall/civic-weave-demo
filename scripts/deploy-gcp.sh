#!/bin/bash

# Civic Weave GCP Deployment Script
# This script builds and deploys the application to GCP

set -e

echo "==================================="
echo "Civic Weave GCP Deployment"
echo "==================================="
echo ""

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo "Error: gcloud CLI is not installed"
    exit 1
fi

# Get current project
PROJECT_ID=$(gcloud config get-value project)
if [ -z "$PROJECT_ID" ]; then
    echo "Error: No GCP project set. Run: gcloud config set project PROJECT_ID"
    exit 1
fi

echo "Deploying to project: $PROJECT_ID"

# Get region from terraform.tfvars or use default
REGION="us-central1"
if [ -f "terraform/terraform.tfvars" ]; then
    REGION=$(grep "region" terraform/terraform.tfvars | cut -d'"' -f2)
fi

echo "Region: $REGION"
echo ""

# Build and push backend
echo "Building and pushing backend..."
cd backend
gcloud builds submit --tag "$REGION-docker.pkg.dev/$PROJECT_ID/civic-weave-docker/backend:latest"
cd ..

echo ""
echo "Backend image pushed successfully!"
echo ""

# Build and push frontend
echo "Building and pushing frontend..."
cd frontend
gcloud builds submit --tag "$REGION-docker.pkg.dev/$PROJECT_ID/civic-weave-docker/frontend:latest"
cd ..

echo ""
echo "Frontend image pushed successfully!"
echo ""

# Update terraform variables
echo "Updating Terraform configuration..."
cd terraform

# Check if terraform.tfvars exists
if [ ! -f "terraform.tfvars" ]; then
    echo "Error: terraform/terraform.tfvars not found"
    echo "Run scripts/gcp-setup.sh first"
    exit 1
fi

# Update or add image URLs
if grep -q "backend_image" terraform.tfvars; then
    sed -i.bak "s|backend_image.*|backend_image = \"$REGION-docker.pkg.dev/$PROJECT_ID/civic-weave-docker/backend:latest\"|" terraform.tfvars
    sed -i.bak "s|frontend_image.*|frontend_image = \"$REGION-docker.pkg.dev/$PROJECT_ID/civic-weave-docker/frontend:latest\"|" terraform.tfvars
    rm terraform.tfvars.bak
else
    cat >> terraform.tfvars <<EOF

# Docker images
backend_image  = "$REGION-docker.pkg.dev/$PROJECT_ID/civic-weave-docker/backend:latest"
frontend_image = "$REGION-docker.pkg.dev/$PROJECT_ID/civic-weave-docker/frontend:latest"
EOF
fi

echo "Configuration updated!"
echo ""

# Apply Terraform
echo "Deploying infrastructure with Terraform..."
terraform apply -auto-approve

echo ""
echo "==================================="
echo "Deployment Complete!"
echo "==================================="
echo ""

# Get URLs
echo "Application URLs:"
terraform output -raw frontend_url
echo ""
terraform output -raw backend_url
echo ""
echo ""
echo "Note: It may take a few minutes for services to become available"
