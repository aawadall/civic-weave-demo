# Quick Start Guide

## Local Development (5 minutes)

### Option 1: Full Docker Stack

```bash
# Start everything
docker-compose up -d

# Access the app
open http://localhost:3000
```

Default test users:
- admin@civicweave.org
- coordinator@civicweave.org
- volunteer@civicweave.org

### Option 2: Development Mode (with hot reload)

```bash
# Terminal 1: Start database
make dev-db

# Terminal 2: Start backend
make backend

# Terminal 3: Start frontend
make frontend
```

Access frontend at http://localhost:3000

## GCP Deployment (15 minutes)

### First Time Setup

```bash
# Run the setup script
./scripts/gcp-setup.sh

# Follow the prompts to:
# 1. Create or select GCP project
# 2. Enable billing
# 3. Configure region
# 4. Initialize Terraform
```

### Deploy Application

```bash
# Build images and deploy
./scripts/deploy-gcp.sh

# The script will output your application URLs
```

### Manual Deployment

```bash
# 1. Initialize infrastructure
cd terraform
terraform init
terraform apply

# 2. Build and push images
cd ../backend
gcloud builds submit --tag REGION-docker.pkg.dev/PROJECT_ID/civic-weave-docker/backend:latest

cd ../frontend
gcloud builds submit --tag REGION-docker.pkg.dev/PROJECT_ID/civic-weave-docker/frontend:latest

# 3. Update terraform.tfvars with image URLs and reapply
cd ../terraform
terraform apply
```

## Common Commands

```bash
make help              # Show all available commands
make up                # Start full stack
make dev               # Start dev environment
make logs              # View logs
make db-shell          # Connect to database
make clean             # Clean everything
```

## Troubleshooting

### Database connection failed
```bash
docker-compose down -v
docker-compose up -d
```

### Frontend can't reach backend
- Check backend is running: `curl http://localhost:8080/api/health`
- Check CORS settings in backend

### GCP deployment issues
- Verify billing is enabled
- Check API enablement: `gcloud services list --enabled`
- Review Cloud Run logs in GCP Console

## Next Steps

1. Explore the codebase structure (see README.md)
2. Implement additional features
3. Configure CI/CD pipelines
4. Set up monitoring and logging
5. Implement proper authentication
6. Add automated tests

## Support

- Full documentation: [README.md](README.md)
- Report issues: Create a GitHub issue
- Architecture details: See individual component READMEs
