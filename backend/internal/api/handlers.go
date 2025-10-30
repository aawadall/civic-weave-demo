package api

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"strings"

	"github.com/civic-weave/backend/internal/auth"
	"github.com/civic-weave/backend/internal/database"
	"github.com/civic-weave/backend/internal/matching"
	"github.com/civic-weave/backend/internal/models"
	"github.com/civic-weave/backend/internal/projects"
	"github.com/civic-weave/backend/internal/skills"
	"github.com/gorilla/mux"
)

type Handler struct {
	authService     *auth.Service
	skillsService   *skills.Service
	projectsService *projects.Service
	matchingService *matching.Service
}

func NewHandler(db *database.PostgresDB) *Handler {
	// Initialize schema
	if err := db.InitSchema(); err != nil {
		log.Printf("Warning: Failed to initialize schema: %v", err)
	}

	authService := auth.NewService(db.DB)

	// Create default users for testing
	if err := authService.CreateDefaultUsers(); err != nil {
		log.Printf("Warning: Failed to create default users: %v", err)
	}

	return &Handler{
		authService:     authService,
		skillsService:   skills.NewService(db.DB),
		projectsService: projects.NewService(db.DB),
		matchingService: matching.NewService(db.DB),
	}
}

func (h *Handler) Health(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

func (h *Handler) GetUsers(w http.ResponseWriter, r *http.Request) {
	users, err := h.authService.GetAllUsers()
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to fetch users")
		return
	}

	respondJSON(w, http.StatusOK, users)
}

func (h *Handler) Login(w http.ResponseWriter, r *http.Request) {
	var req models.LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	user, err := h.authService.GetUserByEmail(req.Email)
	if err == auth.ErrUserNotFound {
		respondError(w, http.StatusNotFound, "User not found")
		return
	}
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to login")
		return
	}

	respondJSON(w, http.StatusOK, user)
}

func (h *Handler) Register(w http.ResponseWriter, r *http.Request) {
	var req models.RegisterRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if req.Email == "" || req.Name == "" {
		respondError(w, http.StatusBadRequest, "Email and name are required")
		return
	}

	user, err := h.authService.RegisterVolunteer(req.Name, req.Email)
	if err == auth.ErrUserExists {
		respondError(w, http.StatusConflict, "User already exists")
		return
	}
	if err != nil {
		log.Printf("Registration error: %v", err)
		respondError(w, http.StatusInternalServerError, "Failed to register user")
		return
	}

	respondJSON(w, http.StatusCreated, user)
}

func respondJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

func respondError(w http.ResponseWriter, status int, message string) {
	respondJSON(w, status, map[string]string{"error": message})
}

// Skills handlers

func (h *Handler) GetSkills(w http.ResponseWriter, r *http.Request) {
	// Check if search query is provided
	query := r.URL.Query().Get("q")
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))

	var skills []models.Skill
	var err error

	if query != "" {
		skills, err = h.skillsService.SearchSkills(query, limit)
	} else {
		skills, err = h.skillsService.GetAllSkills()
	}

	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to fetch skills")
		return
	}

	respondJSON(w, http.StatusOK, skills)
}

func (h *Handler) CreateSkill(w http.ResponseWriter, r *http.Request) {
	var req models.CreateSkillRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if req.Name == "" {
		respondError(w, http.StatusBadRequest, "Skill name is required")
		return
	}

	skill, err := h.skillsService.CreateSkill(req.Name, req.Description, req.Category)
	if err == skills.ErrSkillExists {
		respondError(w, http.StatusConflict, "Skill already exists")
		return
	}
	if err != nil {
		log.Printf("Create skill error: %v", err)
		respondError(w, http.StatusInternalServerError, "Failed to create skill")
		return
	}

	respondJSON(w, http.StatusCreated, skill)
}

func (h *Handler) GetVolunteerSkills(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	volunteerID := vars["id"]

	volunteerSkills, err := h.skillsService.GetVolunteerSkills(volunteerID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to fetch volunteer skills")
		return
	}

	respondJSON(w, http.StatusOK, volunteerSkills)
}

func (h *Handler) UpdateVolunteerSkills(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	volunteerID := vars["id"]

	var req models.UpdateSkillsRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	// Convert request skills to service format
	skillUpdates := make([]struct {
		SkillID string
		Claimed bool
		Score   float64
	}, len(req.Skills))

	for i, skill := range req.Skills {
		skillUpdates[i].SkillID = skill.SkillID
		skillUpdates[i].Claimed = skill.Claimed
		skillUpdates[i].Score = skill.Score
	}

	err := h.skillsService.UpdateVolunteerSkills(volunteerID, skillUpdates)
	if err != nil {
		log.Printf("Update skills error: %v", err)
		respondError(w, http.StatusInternalServerError, "Failed to update skills")
		return
	}

	respondJSON(w, http.StatusOK, map[string]string{"message": "Skills updated successfully"})
}

func (h *Handler) UpdateVolunteerLocation(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	volunteerID := vars["id"]

	var req models.UpdateLocationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	err := h.skillsService.UpdateVolunteerLocation(volunteerID, req.Latitude, req.Longitude, req.LocationName)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to update location")
		return
	}

	respondJSON(w, http.StatusOK, map[string]string{"message": "Location updated successfully"})
}

// Projects handlers

func (h *Handler) GetProjects(w http.ResponseWriter, r *http.Request) {
	log.Printf("GetProjects: fetching all projects")
	projects, err := h.projectsService.GetAllProjects()
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to fetch projects")
		return
	}

	respondJSON(w, http.StatusOK, projects)
}

func (h *Handler) CreateProject(w http.ResponseWriter, r *http.Request) {
	var req models.CreateProjectRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	if strings.TrimSpace(req.Name) == "" {
		respondError(w, http.StatusBadRequest, "Project name is required")
		return
	}
	log.Printf("CreateProject: name=%q status will be 'draft' coordinatorId=%v", req.Name, req.CoordinatorID)
	p, err := h.projectsService.CreateProject(req.Name, req.Description, req.CoordinatorID, req.Latitude, req.Longitude, req.LocationName, req.StartDate, req.EndDate, req.MaxVolunteers)
	if err != nil {
		log.Printf("CreateProject error: %v", err)
		respondError(w, http.StatusInternalServerError, "Failed to create project")
		return
	}
	log.Printf("CreateProject: created id=%s status=%s", p.ID, p.Status)
	respondJSON(w, http.StatusCreated, p)
}

func (h *Handler) GetProject(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	projectID := vars["id"]

	project, err := h.projectsService.GetProject(projectID)
	if err == projects.ErrProjectNotFound {
		respondError(w, http.StatusNotFound, "Project not found")
		return
	}
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to fetch project")
		return
	}

	respondJSON(w, http.StatusOK, project)
}

func (h *Handler) GetProjectSkills(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	projectID := vars["id"]

	projectSkills, err := h.projectsService.GetProjectSkills(projectID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to fetch project skills")
		return
	}

	respondJSON(w, http.StatusOK, projectSkills)
}

func (h *Handler) UpdateProjectSkills(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	projectID := vars["id"]

	var req models.UpdateProjectSkillsRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	// Convert request skills to service format
	skillUpdates := make([]struct {
		SkillID  string
		Required bool
		Weight   float64
	}, len(req.Skills))

	for i, skill := range req.Skills {
		skillUpdates[i].SkillID = skill.SkillID
		skillUpdates[i].Required = skill.Required
		skillUpdates[i].Weight = skill.Weight
	}

	err := h.projectsService.SetProjectSkills(projectID, skillUpdates)
	if err != nil {
		log.Printf("Update project skills error: %v", err)
		respondError(w, http.StatusInternalServerError, "Failed to update project skills")
		return
	}

	respondJSON(w, http.StatusOK, map[string]string{"message": "Project skills updated successfully"})
}

func (h *Handler) UpdateProjectDetails(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	projectID := vars["id"]

	var req models.UpdateProjectRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	log.Printf("UpdateProjectDetails: id=%s name=%q hasLocation=%v", projectID, req.Name, req.LocationName != nil)
	if err := h.projectsService.UpdateProjectDetails(projectID, req.Name, req.Description, req.Latitude, req.Longitude, req.LocationName); err != nil {
		log.Printf("UpdateProjectDetails error id=%s: %v", projectID, err)
		respondError(w, http.StatusInternalServerError, "Failed to update project")
		return
	}

	respondJSON(w, http.StatusOK, map[string]string{"message": "Project updated successfully"})
}

func (h *Handler) UpdateProjectStatus(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	projectID := vars["id"]

	var req models.UpdateProjectStatusRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	if req.Status == "" {
		respondError(w, http.StatusBadRequest, "Status is required")
		return
	}
	log.Printf("UpdateProjectStatus: id=%s -> %s", projectID, req.Status)
	if err := h.projectsService.UpdateProjectStatus(projectID, req.Status); err != nil {
		log.Printf("UpdateProjectStatus error id=%s: %v", projectID, err)
		respondError(w, http.StatusInternalServerError, "Failed to update status")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"message": "Status updated"})
}

// Matching handlers

func (h *Handler) FindMatchesForProject(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	projectID := vars["id"]

	// Get impersonation parameter (optional)
	impersonateRole := r.URL.Query().Get("impersonate")

	// Simple role check - only allow coordinators to access matching
	// For demo purposes, we'll check if impersonate=coordinator is provided
	if impersonateRole != "coordinator" {
		respondError(w, http.StatusForbidden, "Access denied. Only coordinators can view volunteer matches. Use ?impersonate=coordinator")
		return
	}

	// Get query parameters
	skillWeight, _ := strconv.ParseFloat(r.URL.Query().Get("skillWeight"), 64)
	distanceWeight, _ := strconv.ParseFloat(r.URL.Query().Get("distanceWeight"), 64)
	maxDistanceKm, _ := strconv.ParseFloat(r.URL.Query().Get("maxDistanceKm"), 64)
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))

	// Defaults
	if skillWeight == 0 && distanceWeight == 0 {
		skillWeight = 0.7
		distanceWeight = 0.3
	}
	if maxDistanceKm == 0 {
		maxDistanceKm = 100 // Default 100km radius
	}
	if limit == 0 {
		limit = 20 // Default 20 results
	}

	matches, err := h.matchingService.FindMatchingVolunteers(
		projectID,
		skillWeight,
		distanceWeight,
		maxDistanceKm,
		limit,
	)
	if err != nil {
		log.Printf("Matching error: %v", err)
		// Return empty array to avoid null on frontend while investigating
		respondJSON(w, http.StatusOK, []models.VolunteerMatch{})
		return
	}

	// Ensure non-nil slice
	if matches == nil {
		matches = []models.VolunteerMatch{}
	}
	respondJSON(w, http.StatusOK, matches)
}

func (h *Handler) RefreshSkillVectors(w http.ResponseWriter, r *http.Request) {
	err := h.matchingService.RefreshSkillVectors()
	if err != nil {
		log.Printf("Refresh skill vectors error: %v", err)
		respondError(w, http.StatusInternalServerError, "Failed to refresh skill vectors")
		return
	}

	respondJSON(w, http.StatusOK, map[string]string{"message": "Skill vectors refreshed successfully"})
}

func (h *Handler) FindMatchesForVolunteer(w http.ResponseWriter, r *http.Request) {
	log.Printf("FindMatchesForVolunteer called")
	vars := mux.Vars(r)
	volunteerID := vars["id"]
	log.Printf("Volunteer ID: %s", volunteerID)

	// Impersonation: allow volunteers
	impersonateRole := r.URL.Query().Get("impersonate")
	log.Printf("Impersonate role: %s", impersonateRole)
	if impersonateRole != "volunteer" {
		respondError(w, http.StatusForbidden, "Access denied. Only volunteers can view project matches. Use ?impersonate=volunteer")
		return
	}

	// Simple test response
	respondJSON(w, http.StatusOK, []models.ProjectMatch{
		{
			ProjectID:     "test-id",
			ProjectName:   "Test Project",
			SkillScore:    0.5,
			DistanceKm:    0.0,
			CombinedScore: 0.5,
			MatchedSkills: []string{},
		},
	})
	return

	skillWeight, _ := strconv.ParseFloat(r.URL.Query().Get("skillWeight"), 64)
	distanceWeight, _ := strconv.ParseFloat(r.URL.Query().Get("distanceWeight"), 64)
	maxDistanceKm, _ := strconv.ParseFloat(r.URL.Query().Get("maxDistanceKm"), 64)
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))

	if skillWeight == 0 && distanceWeight == 0 {
		skillWeight = 0.7
		distanceWeight = 0.3
	}
	if maxDistanceKm == 0 {
		maxDistanceKm = 100
	}
	if limit == 0 {
		limit = 20
	}

	matches, err := h.matchingService.FindMatchingProjects(
		volunteerID,
		skillWeight,
		distanceWeight,
		maxDistanceKm,
		limit,
	)
	if err != nil {
		log.Printf("Project matching error: %v", err)
		respondError(w, http.StatusInternalServerError, fmt.Sprintf("Project matching error: %v", err))
		return
	}

	respondJSON(w, http.StatusOK, matches)
}
