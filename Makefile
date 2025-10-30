.PHONY: help dev dev-db up down build clean logs frontend backend test

help: ## Show this help message
	@echo 'Usage: make [target]'
	@echo ''
	@echo 'Available targets:'
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  %-15s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

dev: dev-db ## Start development environment (DB only, run frontend/backend manually)
	@echo "Database started. Run 'make frontend' and 'make backend' in separate terminals"

dev-db: ## Start only the database for development
	docker-compose -f docker-compose.dev.yml up -d
	@echo "Waiting for database to be ready..."
	@sleep 3
	@echo "Database ready on localhost:5432"

up: ## Start all services with Docker Compose
	docker-compose up -d
	@echo "Services started:"
	@echo "  Frontend: http://localhost:3000"
	@echo "  Backend:  http://localhost:8080"
	@echo "  Database: localhost:5432"

down: ## Stop all services
	docker-compose down
	docker-compose -f docker-compose.dev.yml down

build: ## Build all Docker images
	docker-compose build

clean: ## Remove all containers, volumes, and images
	docker-compose down -v --rmi all
	docker-compose -f docker-compose.dev.yml down -v

logs: ## Show logs from all services
	docker-compose logs -f

logs-backend: ## Show backend logs
	docker-compose logs -f backend

logs-frontend: ## Show frontend logs
	docker-compose logs -f frontend

logs-db: ## Show database logs
	docker-compose logs -f postgres

frontend: ## Run frontend in development mode (requires dev-db)
	cd frontend && npm install && npm run dev

backend: ## Run backend in development mode (requires dev-db)
	cd backend && go mod download && go run cmd/api/main.go

test-backend: ## Run backend tests
	cd backend && go test ./...

test-frontend: ## Run frontend tests
	cd frontend && npm test

db-shell: ## Connect to database shell
	docker exec -it civic-weave-db psql -U postgres -d civic_weave

db-reset: ## Reset database (WARNING: deletes all data)
	docker-compose down -v
	docker-compose up -d postgres

# GCP deployment targets
gcp-setup: ## Setup GCP project (requires gcloud)
	@echo "Make sure to edit terraform/terraform.tfvars first!"
	@read -p "Have you edited terraform.tfvars? (y/N) " confirm && [ $$confirm = y ]
	cd terraform && terraform init

gcp-plan: ## Plan Terraform changes
	cd terraform && terraform plan

gcp-apply: ## Apply Terraform changes
	cd terraform && terraform apply

gcp-destroy: ## Destroy GCP infrastructure (WARNING: deletes everything)
	cd terraform && terraform destroy

gcp-build-backend: ## Build and push backend to GCP
	cd backend && gcloud builds submit --tag $(REGION)-docker.pkg.dev/$(PROJECT_ID)/civic-weave-docker/backend:latest

gcp-build-frontend: ## Build and push frontend to GCP
	cd frontend && gcloud builds submit --tag $(REGION)-docker.pkg.dev/$(PROJECT_ID)/civic-weave-docker/frontend:latest

gcp-outputs: ## Show Terraform outputs
	cd terraform && terraform output
