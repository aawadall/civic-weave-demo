# Civic Weave - Volunteering CRM

A modern volunteering CRM application with impersonation and lazy registration features.

## Architecture

- **Frontend**: React SPA with TypeScript and Vite
- **Backend**: Golang monolithic API
- **Database**: PostgreSQL 15 with pgvector + PostGIS extensions
- **Infrastructure**: GCP (Cloud Run, Cloud SQL)
- **IaC**: Terraform

### PostgreSQL Optimizations

Civic Weave leverages advanced PostgreSQL features for high performance:
- **pgvector**: Native vector operations for 10-100x faster skill matching
- **PostGIS**: Efficient geospatial queries and distance calculations
- **Full-text search**: Fast, ranked skill search with stemming

See [POSTGRESQL_OPTIMIZATIONS.md](POSTGRESQL_OPTIMIZATIONS.md) for details.

## Features

### Implemented
- **User impersonation** (select existing role)
- **Volunteer self-registration** with lazy registration
- **Skills matching system** with cosine similarity and geo-location
  - Boolean skill vectors with proficiency scores [0, 1]
  - Cosine similarity for skill matching
  - Haversine distance for geo-location
  - Combined weighted scoring (configurable skill/distance weights)
- **Skills management** for volunteers
- **Project browsing** and matching
- **Real-time volunteer matching** for projects
- Basic authentication flow
- User profile management

### Coming Soon
- Complete profile workflow
- Project creation and management UI
- Event scheduling
- Task assignment
- Volunteer time tracking
- Reporting and analytics

## Local Development

### Prerequisites
- Docker and Docker Compose
- Node.js 18+ (for local frontend development)
- Go 1.21+ (for local backend development)
- Make (optional, for convenience commands)

### Quick Start with Docker

1. Start all services:
```bash
docker-compose up -d
```

2. Wait for migrations to complete (check logs):
```bash
docker logs civic-weave-db
# Look for "PostgreSQL init process complete"
```

3. Access the application:
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:8080
   - Database: localhost:5432 (pgvector/pgvector:pg15)

4. Default test users:
   - admin@civicweave.org (Admin User)
   - coordinator@civicweave.org (Coordinator User)
   - volunteer@civicweave.org (Volunteer User)

**Note:** The database now uses `pgvector/pgvector:pg15` image which includes pgvector and PostGIS extensions.

### Development with Hot Reload

For a better development experience with hot reload:

1. Start only the database:
```bash
docker-compose -f docker-compose.dev.yml up -d
```

2. Run backend locally:
```bash
cd backend
go mod download
go run cmd/api/main.go
```

3. Run frontend locally:
```bash
cd frontend
npm install
npm run dev
```

Frontend will be available at http://localhost:3000 with hot reload.

### Database Migrations

Migrations are automatically applied when the database container starts. Manual migration files are located in `database/migrations/`.

To connect to the database:
```bash
docker exec -it civic-weave-db psql -U postgres -d civic_weave
```

## GCP Deployment

### Prerequisites
- GCP account with billing enabled
- `gcloud` CLI installed and configured
- Terraform installed

### Setup GCP Project

1. Create a new GCP project:
```bash
gcloud projects create YOUR_PROJECT_ID --name="Civic Weave"
gcloud config set project YOUR_PROJECT_ID
```

2. Enable billing for the project via GCP Console

3. Authenticate Terraform:
```bash
gcloud auth application-default login
```

### Infrastructure Deployment

1. Navigate to terraform directory:
```bash
cd terraform
```

2. Copy and configure variables:
```bash
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with your project details
```

3. Initialize Terraform:
```bash
terraform init
```

4. Review and apply infrastructure:
```bash
terraform plan
terraform apply
```

This will create:
- Cloud SQL PostgreSQL instance
- Artifact Registry repository
- Cloud Run services (placeholder images initially)
- Service accounts and IAM bindings
- Secret Manager for database credentials

### Application Deployment

1. Build and push backend image:
```bash
cd backend
gcloud builds submit --tag us-central1-docker.pkg.dev/YOUR_PROJECT_ID/civic-weave-docker/backend:latest
```

2. Build and push frontend image:
```bash
cd frontend
gcloud builds submit --tag us-central1-docker.pkg.dev/YOUR_PROJECT_ID/civic-weave-docker/frontend:latest
```

3. Update Terraform variables with actual image URLs:
```hcl
backend_image  = "us-central1-docker.pkg.dev/YOUR_PROJECT_ID/civic-weave-docker/backend:latest"
frontend_image = "us-central1-docker.pkg.dev/YOUR_PROJECT_ID/civic-weave-docker/frontend:latest"
```

4. Apply Terraform again to deploy new images:
```bash
terraform apply
```

5. Get service URLs:
```bash
terraform output frontend_url
terraform output backend_url
```

### CI/CD Setup (Optional)

For automated deployments, set up Cloud Build triggers:

1. Connect your GitHub repository to Cloud Build
2. Create build triggers for main branch
3. Use the provided cloudbuild.yaml configurations

## Skills Matching Algorithm

The application uses a sophisticated matching algorithm combining:

1. **Skill Vector Representation**
   - Volunteers: Boolean claims × proficiency scores
   - Projects: Skill demands × weights
   - All values in range [0, 1]

2. **Cosine Similarity**
   - Measures angle between skill vectors
   - Returns similarity score in [0, 1]
   - Perfect match = 1, no overlap = 0

3. **Haversine Geo-Distance**
   - Calculates great-circle distance
   - Normalized by maximum distance
   - Converts to distance score [0, 1]

4. **Combined Weighted Score**
   - Default: 70% skills, 30% distance
   - Configurable weights per project
   - Results sorted by combined score

See [SKILLS_MATCHING.md](SKILLS_MATCHING.md) for detailed algorithm documentation.

## Project Structure

```
.
├── backend/                 # Golang backend
│   ├── cmd/api/            # Application entry point
│   ├── internal/           # Internal packages
│   │   ├── api/           # HTTP handlers
│   │   ├── auth/          # Authentication logic
│   │   ├── skills/        # Skills management service
│   │   ├── projects/      # Projects management service
│   │   ├── matching/      # Cosine similarity + geo matching
│   │   ├── database/      # Database connection
│   │   └── models/        # Data models
│   ├── Dockerfile         # Backend Docker image
│   └── go.mod             # Go dependencies
├── frontend/               # React frontend
│   ├── src/
│   │   ├── pages/         # Page components
│   │   ├── components/    # Reusable components
│   │   ├── api.ts         # API client
│   │   └── types.ts       # TypeScript types
│   ├── Dockerfile         # Frontend Docker image
│   ├── nginx.conf         # Nginx configuration
│   └── package.json       # Node dependencies
├── terraform/              # Infrastructure as Code
│   ├── main.tf            # Main Terraform config
│   ├── variables.tf       # Variable definitions
│   ├── outputs.tf         # Output values
│   └── providers.tf       # Provider configuration
├── database/               # Database files
│   └── migrations/        # SQL migration files
├── docker-compose.yml      # Full stack Docker setup
└── docker-compose.dev.yml  # Development Docker setup
```

## API Endpoints

### Authentication
- `GET /api/users` - List all users
- `POST /api/auth/login` - Login as existing user
- `POST /api/auth/register` - Register new volunteer

### Skills Management
- `GET /api/skills` - List all skills
- `GET /api/volunteers/:id/skills` - Get volunteer's skills
- `PUT /api/volunteers/:id/skills` - Update volunteer's skills
- `PUT /api/volunteers/:id/location` - Update volunteer's location

### Projects
- `GET /api/projects` - List all projects
- `GET /api/projects/:id` - Get project details
- `GET /api/projects/:id/skills` - Get project skill requirements

### Matching
- `GET /api/projects/:id/matches` - Find matching volunteers for a project
  - Query params: `skillWeight`, `distanceWeight`, `maxDistanceKm`, `limit`

### Health Check
- `GET /api/health` - Service health status

## Environment Variables

### Backend
- `DB_HOST` - Database host (default: localhost)
- `DB_PORT` - Database port (default: 5432)
- `DB_USER` - Database user (default: postgres)
- `DB_PASSWORD` - Database password (default: postgres)
- `DB_NAME` - Database name (default: civic_weave)
- `PORT` - Server port (default: 8080)

### Frontend
- `BACKEND_URL` - Backend API URL (configured via Vite proxy)

## Development Guidelines

### Frontend
- Use TypeScript for type safety
- Follow React best practices and hooks patterns
- Keep components small and focused
- Use the API client in `src/api.ts` for backend calls

### Backend
- Follow Go standard project layout
- Keep handlers thin, business logic in services
- Use proper error handling and logging
- Write tests for critical functionality

### Database
- Use migrations for schema changes
- Follow PostgreSQL naming conventions
- Add indexes for frequently queried columns
- Keep sensitive data encrypted

## Troubleshooting

### Database connection errors
- Ensure PostgreSQL container is running: `docker ps`
- Check logs: `docker logs civic-weave-db`
- Verify connection details in environment variables

### Frontend can't connect to backend
- Ensure backend is running on port 8080
- Check CORS configuration in backend
- Verify proxy settings in `vite.config.ts`

### GCP deployment issues
- Verify all required APIs are enabled
- Check service account permissions
- Review Cloud Run logs in GCP Console
- Ensure database is accessible from Cloud Run

## Security Considerations

- Change default database passwords in production
- Enable Cloud SQL private IP in production
- Set `enable_public_access = false` in Terraform for production
- Use Cloud Armor for DDoS protection
- Implement proper authentication and authorization
- Use HTTPS/TLS for all communications
- Regular security audits and updates

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Write/update tests
5. Submit a pull request

## License

[Add your license here]

## Support

For issues and questions:
- Create an issue in the repository
- Contact the development team
