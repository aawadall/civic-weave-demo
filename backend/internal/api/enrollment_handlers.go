package api

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"

	"github.com/civic-weave/backend/internal/enrollment"
	"github.com/civic-weave/backend/internal/models"
	"github.com/gorilla/mux"
)

type EnrollmentHandler struct {
	enrollmentService *enrollment.Service
}

func NewEnrollmentHandler(enrollmentService *enrollment.Service) *EnrollmentHandler {
	return &EnrollmentHandler{
		enrollmentService: enrollmentService,
	}
}

// CreateEnrollment creates a new enrollment request
func (h *EnrollmentHandler) CreateEnrollment(w http.ResponseWriter, r *http.Request) {
	var req models.CreateEnrollmentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		log.Printf("ERROR: Failed to decode request body: %v", err)
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Get user ID from query parameter (in real app, this would come from auth)
	userID := r.URL.Query().Get("userId")
	if userID == "" {
		log.Printf("ERROR: User ID not provided")
		http.Error(w, "User ID required", http.StatusBadRequest)
		return
	}

	log.Printf("DEBUG: CreateEnrollment request - ProjectID: %s, Action: %s, VolunteerID: %v, UserID: %s",
		req.ProjectID, req.Action, req.VolunteerID, userID)

	// Validate action
	if req.Action != "request" && req.Action != "invite" {
		http.Error(w, "Invalid action (must be 'request' or 'invite')", http.StatusBadRequest)
		return
	}

	// For "request" action, volunteer initiates for themselves
	// For "invite" action, TL initiates and specifies which volunteer to invite
	volunteerID := userID
	if req.Action == "invite" {
		if req.VolunteerID == nil || *req.VolunteerID == "" {
			http.Error(w, "Volunteer ID required for invite action", http.StatusBadRequest)
			return
		}
		volunteerID = *req.VolunteerID
	}

	var message string
	if req.Message != nil {
		message = *req.Message
	}

	enrollment, err := h.enrollmentService.CreateEnrollment(
		volunteerID,
		req.ProjectID,
		req.Action,
		message,
		userID,
	)
	if err != nil {
		log.Printf("ERROR: Failed to create enrollment - volunteerID: %s, projectID: %s, action: %s, error: %v",
			volunteerID, req.ProjectID, req.Action, err)

		// Check for duplicate enrollment error
		errStr := strings.ToLower(fmt.Sprintf("%v", err))
		if strings.Contains(errStr, "duplicate key") && strings.Contains(errStr, "volunteer_enrollments_volunteer_id_project_id_key") {
			http.Error(w, "This volunteer is already enrolled or has a pending enrollment for this project", http.StatusConflict)
			return
		}

		http.Error(w, fmt.Sprintf("Failed to create enrollment: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(enrollment)
}

// GetProjectEnrollments gets all enrollments for a project
func (h *EnrollmentHandler) GetProjectEnrollments(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	projectID := vars["projectId"]

	enrollments, err := h.enrollmentService.GetProjectEnrollments(projectID)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to get project enrollments: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(enrollments)
}

// GetVolunteerEnrollments gets all enrollments for a volunteer
func (h *EnrollmentHandler) GetVolunteerEnrollments(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	volunteerID := vars["volunteerId"]

	enrollments, err := h.enrollmentService.GetVolunteerEnrollments(volunteerID)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to get volunteer enrollments: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(enrollments)
}

// UpdateEnrollmentStatus updates the status of an enrollment
func (h *EnrollmentHandler) UpdateEnrollmentStatus(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	enrollmentID := vars["enrollmentId"]

	var req models.UpdateEnrollmentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		log.Printf("ERROR: Failed to decode update enrollment request: %v", err)
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	log.Printf("DEBUG: UpdateEnrollmentStatus request - EnrollmentID: %s, Action: %s", enrollmentID, req.Action)

	// Validate action
	if req.Action != "accept" && req.Action != "reject" && req.Action != "withdraw" {
		log.Printf("ERROR: Invalid action provided: %s", req.Action)
		http.Error(w, "Invalid action (must be 'accept', 'reject' or 'withdraw')", http.StatusBadRequest)
		return
	}

	var responseMessage string
	if req.ResponseMessage != nil {
		responseMessage = *req.ResponseMessage
	}

	err := h.enrollmentService.UpdateEnrollmentStatus(enrollmentID, req.Action, responseMessage)
	if err != nil {
		log.Printf("ERROR: Failed to update enrollment status - enrollmentID: %s, action: %s, error: %v",
			enrollmentID, req.Action, err)
		// Map invalid transitions to 400
		if strings.HasPrefix(err.Error(), "cannot ") || strings.Contains(strings.ToLower(err.Error()), "invalid action") {
			http.Error(w, fmt.Sprintf("Bad request: %v", err), http.StatusBadRequest)
			return
		}
		http.Error(w, fmt.Sprintf("Failed to update enrollment: %v", err), http.StatusInternalServerError)
		return
	}

	log.Printf("INFO: Successfully executed %s action on enrollment %s", req.Action, enrollmentID)
	w.WriteHeader(http.StatusOK)
}

// CheckEnrollmentStatus checks if a volunteer is enrolled in a project
func (h *EnrollmentHandler) CheckEnrollmentStatus(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	volunteerID := vars["volunteerId"]
	projectID := vars["projectId"]

	enrolled, err := h.enrollmentService.IsVolunteerEnrolled(volunteerID, projectID)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to check enrollment status: %v", err), http.StatusInternalServerError)
		return
	}

	response := map[string]bool{"enrolled": enrolled}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// GetPendingEnrollments gets all pending enrollments (for TLs to review)
func (h *EnrollmentHandler) GetPendingEnrollments(w http.ResponseWriter, r *http.Request) {
	// This would need to be implemented in the service layer
	// For now, return empty array
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode([]models.EnrollmentWithDetails{})
}
