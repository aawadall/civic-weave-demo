package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"time"

	"github.com/civic-weave/backend/internal/api"
	"github.com/civic-weave/backend/internal/database"
	"github.com/civic-weave/backend/internal/enrollment"
	"github.com/gorilla/mux"
	"github.com/rs/cors"
)

func main() {
	// Load configuration from environment
	dbHost := getEnv("DB_HOST", "localhost")
	dbPort := getEnv("DB_PORT", "5432")
	dbUser := getEnv("DB_USER", "postgres")
	dbPassword := getEnv("DB_PASSWORD", "postgres")
	dbName := getEnv("DB_NAME", "civic_weave")
	port := getEnv("PORT", "8080")

	// Initialize database
	db, err := database.NewPostgresDB(dbHost, dbPort, dbUser, dbPassword, dbName)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer db.Close()

	log.Println("Database connection established")

	// Initialize services
	enrollmentService := enrollment.NewService(db.DB)

	// Initialize API handlers
	handler := api.NewHandler(db)
	enrollmentHandler := api.NewEnrollmentHandler(enrollmentService)

	// Setup router
	r := mux.NewRouter()

	// API routes
	apiRouter := r.PathPrefix("/api").Subrouter()

	// Auth routes
	apiRouter.HandleFunc("/users", handler.GetUsers).Methods("GET")
	apiRouter.HandleFunc("/auth/login", handler.Login).Methods("POST")
	apiRouter.HandleFunc("/auth/register", handler.Register).Methods("POST")
	apiRouter.HandleFunc("/health", handler.Health).Methods("GET")

	// Skills routes
	apiRouter.HandleFunc("/skills", handler.GetSkills).Methods("GET")
	apiRouter.HandleFunc("/skills", handler.CreateSkill).Methods("POST")
	apiRouter.HandleFunc("/volunteers/{id}/skills", handler.GetVolunteerSkills).Methods("GET")
	apiRouter.HandleFunc("/volunteers/{id}/skills", handler.UpdateVolunteerSkills).Methods("PUT")
	apiRouter.HandleFunc("/volunteers/{id}/location", handler.UpdateVolunteerLocation).Methods("PUT")

	// Projects routes
	apiRouter.HandleFunc("/projects", handler.GetProjects).Methods("GET")
	apiRouter.HandleFunc("/projects", handler.CreateProject).Methods("POST")
	apiRouter.HandleFunc("/projects/{id}", handler.GetProject).Methods("GET")
	apiRouter.HandleFunc("/projects/{id}", handler.UpdateProjectDetails).Methods("PUT")
	apiRouter.HandleFunc("/projects/{id}/skills", handler.GetProjectSkills).Methods("GET")
	apiRouter.HandleFunc("/projects/{id}/skills", handler.UpdateProjectSkills).Methods("PUT")
	apiRouter.HandleFunc("/projects/{id}/status", handler.UpdateProjectStatus).Methods("PUT")

	// Matching routes
	apiRouter.HandleFunc("/projects/{id}/matches", handler.FindMatchesForProject).Methods("GET")
	apiRouter.HandleFunc("/volunteers/{id}/matches", handler.FindMatchesForVolunteer).Methods("GET")
	apiRouter.HandleFunc("/admin/refresh-vectors", handler.RefreshSkillVectors).Methods("POST")

	// Enrollment routes
	apiRouter.HandleFunc("/enrollments", enrollmentHandler.CreateEnrollment).Methods("POST")
	apiRouter.HandleFunc("/projects/{projectId}/enrollments", enrollmentHandler.GetProjectEnrollments).Methods("GET")
	apiRouter.HandleFunc("/volunteers/{volunteerId}/enrollments", enrollmentHandler.GetVolunteerEnrollments).Methods("GET")
	apiRouter.HandleFunc("/enrollments/{enrollmentId}/status", enrollmentHandler.UpdateEnrollmentStatus).Methods("PUT")
	apiRouter.HandleFunc("/volunteers/{volunteerId}/projects/{projectId}/enrollment-status", enrollmentHandler.CheckEnrollmentStatus).Methods("GET")
	apiRouter.HandleFunc("/enrollments/pending", enrollmentHandler.GetPendingEnrollments).Methods("GET")

	// CORS middleware
	c := cors.New(cors.Options{
		AllowedOrigins:   []string{"*"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"*"},
		AllowCredentials: true,
	})

	// Create server
	srv := &http.Server{
		Addr:         ":" + port,
		Handler:      c.Handler(r),
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Start server in a goroutine
	go func() {
		log.Printf("Server starting on port %s", port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server error: %v", err)
		}
	}()

	// Graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, os.Interrupt)
	<-quit

	log.Println("Shutting down server...")

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		log.Fatalf("Server forced to shutdown: %v", err)
	}

	log.Println("Server stopped")
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
