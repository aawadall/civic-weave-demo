package enrollment

import (
	"database/sql"
	"fmt"
	"time"

	"github.com/civic-weave/backend/internal/models"
)

type Service struct {
	db *sql.DB
}

func NewService(db *sql.DB) *Service {
	return &Service{db: db}
}

func (s *Service) CreateEnrollment(volunteerID, projectID, action, message, initiatedBy string) (*models.Enrollment, error) {
	// Determine initial status based on action
	var status string
	if action == "request" {
		status = "requested" // Volunteer requesting to join
	} else if action == "invite" {
		status = "invited" // TL inviting volunteer
	} else {
		return nil, fmt.Errorf("invalid action: %s (must be 'request' or 'invite')", action)
	}

	query := `
		INSERT INTO volunteer_enrollments (volunteer_id, project_id, status, initiated_by, message)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, volunteer_id, project_id, status, initiated_by, message, response_message, created_at, updated_at, approved_at, completed_at
	`

	var enrollment models.Enrollment
	var messagePtr, responseMessagePtr *string
	var approvedAt, completedAt *time.Time

	if message != "" {
		messagePtr = &message
	}

	err := s.db.QueryRow(query, volunteerID, projectID, status, initiatedBy, messagePtr).Scan(
		&enrollment.ID,
		&enrollment.VolunteerID,
		&enrollment.ProjectID,
		&enrollment.Status,
		&enrollment.InitiatedBy,
		&messagePtr,
		&responseMessagePtr,
		&enrollment.CreatedAt,
		&enrollment.UpdatedAt,
		&approvedAt,
		&completedAt,
	)

	if err != nil {
		return nil, fmt.Errorf("failed to create enrollment: %w", err)
	}

	enrollment.Message = messagePtr
	enrollment.ResponseMessage = responseMessagePtr
	enrollment.ApprovedAt = approvedAt
	enrollment.CompletedAt = completedAt

	return &enrollment, nil
}

func (s *Service) GetProjectEnrollments(projectID string) ([]models.EnrollmentWithDetails, error) {
	query := `
		SELECT
			ve.id,
			ve.volunteer_id,
			ve.project_id,
			ve.status,
			ve.initiated_by,
			ve.message,
			ve.response_message,
			ve.created_at,
			ve.updated_at,
			ve.approved_at,
			ve.completed_at,
			u.name as volunteer_name,
			u.email as volunteer_email,
			p.name as project_name,
			initiator.name as initiated_by_name
		FROM volunteer_enrollments ve
		JOIN users u ON u.id = ve.volunteer_id
		JOIN projects p ON p.id = ve.project_id
		JOIN users initiator ON initiator.id = ve.initiated_by
		WHERE ve.project_id = $1
		ORDER BY ve.created_at DESC
	`

	rows, err := s.db.Query(query, projectID)
	if err != nil {
		return nil, fmt.Errorf("failed to get project enrollments: %w", err)
	}
	defer rows.Close()

	var enrollments []models.EnrollmentWithDetails
	for rows.Next() {
		var enrollment models.EnrollmentWithDetails
		var messagePtr, responseMessagePtr *string
		var approvedAt, completedAt *time.Time

		err := rows.Scan(
			&enrollment.ID,
			&enrollment.VolunteerID,
			&enrollment.ProjectID,
			&enrollment.Status,
			&enrollment.InitiatedBy,
			&messagePtr,
			&responseMessagePtr,
			&enrollment.CreatedAt,
			&enrollment.UpdatedAt,
			&approvedAt,
			&completedAt,
			&enrollment.VolunteerName,
			&enrollment.VolunteerEmail,
			&enrollment.ProjectName,
			&enrollment.InitiatedByName,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan enrollment: %w", err)
		}

		enrollment.Message = messagePtr
		enrollment.ResponseMessage = responseMessagePtr
		enrollment.ApprovedAt = approvedAt
		enrollment.CompletedAt = completedAt

		enrollments = append(enrollments, enrollment)
	}

	return enrollments, nil
}

func (s *Service) GetVolunteerEnrollments(volunteerID string) ([]models.EnrollmentWithDetails, error) {
	query := `
		SELECT
			ve.id,
			ve.volunteer_id,
			ve.project_id,
			ve.status,
			ve.initiated_by,
			ve.message,
			ve.response_message,
			ve.created_at,
			ve.updated_at,
			ve.approved_at,
			ve.completed_at,
			u.name as volunteer_name,
			u.email as volunteer_email,
			p.name as project_name,
			initiator.name as initiated_by_name
		FROM volunteer_enrollments ve
		JOIN users u ON u.id = ve.volunteer_id
		JOIN projects p ON p.id = ve.project_id
		JOIN users initiator ON initiator.id = ve.initiated_by
		WHERE ve.volunteer_id = $1
		ORDER BY ve.created_at DESC
	`

	rows, err := s.db.Query(query, volunteerID)
	if err != nil {
		return nil, fmt.Errorf("failed to get volunteer enrollments: %w", err)
	}
	defer rows.Close()

	var enrollments []models.EnrollmentWithDetails
	for rows.Next() {
		var enrollment models.EnrollmentWithDetails
		var messagePtr, responseMessagePtr *string
		var approvedAt, completedAt *time.Time

		err := rows.Scan(
			&enrollment.ID,
			&enrollment.VolunteerID,
			&enrollment.ProjectID,
			&enrollment.Status,
			&enrollment.InitiatedBy,
			&messagePtr,
			&responseMessagePtr,
			&enrollment.CreatedAt,
			&enrollment.UpdatedAt,
			&approvedAt,
			&completedAt,
			&enrollment.VolunteerName,
			&enrollment.VolunteerEmail,
			&enrollment.ProjectName,
			&enrollment.InitiatedByName,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan enrollment: %w", err)
		}

		enrollment.Message = messagePtr
		enrollment.ResponseMessage = responseMessagePtr
		enrollment.ApprovedAt = approvedAt
		enrollment.CompletedAt = completedAt

		enrollments = append(enrollments, enrollment)
	}

	return enrollments, nil
}

func (s *Service) UpdateEnrollmentStatus(enrollmentID, action, responseMessage string) error {
	// First, get current status to determine valid transitions
	var currentStatus string
	err := s.db.QueryRow("SELECT status FROM volunteer_enrollments WHERE id = $1", enrollmentID).Scan(&currentStatus)
	if err != nil {
		if err == sql.ErrNoRows {
			return fmt.Errorf("enrollment not found")
		}
		return fmt.Errorf("failed to get current status: %w", err)
	}

	// Determine new status based on current status and action
	var newStatus string
	if action == "accept" {
		if currentStatus == "requested" || currentStatus == "invited" {
			newStatus = "enrolled"
		} else {
			return fmt.Errorf("cannot accept enrollment in status: %s", currentStatus)
		}
	} else if action == "reject" {
		if currentStatus == "requested" {
			newStatus = "tl_rejected" // TL rejecting volunteer's request
		} else if currentStatus == "invited" {
			newStatus = "v_rejected" // Volunteer rejecting TL's invitation
		} else {
			return fmt.Errorf("cannot reject enrollment in status: %s", currentStatus)
		}
	} else if action == "withdraw" {
		if currentStatus == "requested" {
			newStatus = "v_rejected" // Volunteer withdrawing their own request
		} else {
			return fmt.Errorf("cannot withdraw enrollment in status: %s", currentStatus)
		}
	} else {
		return fmt.Errorf("invalid action: %s (must be 'accept' or 'reject')", action)
	}

	query := `
		UPDATE volunteer_enrollments
		SET
			status = $2,
			response_message = $3,
			updated_at = NOW(),
			approved_at = CASE WHEN $2 = 'enrolled' THEN NOW() ELSE approved_at END
		WHERE id = $1
	`

	// Convert empty string to NULL for response_message
	var responseMessageParam interface{}
	if responseMessage == "" {
		responseMessageParam = nil
	} else {
		responseMessageParam = responseMessage
	}

	result, err := s.db.Exec(query, enrollmentID, newStatus, responseMessageParam)
	if err != nil {
		return fmt.Errorf("failed to update enrollment status: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to get rows affected: %w", err)
	}

	if rowsAffected == 0 {
		return fmt.Errorf("enrollment not found")
	}

	return nil
}

func (s *Service) IsVolunteerEnrolled(volunteerID, projectID string) (bool, error) {
	query := `
		SELECT EXISTS (
			SELECT 1 FROM volunteer_enrollments
			WHERE volunteer_id = $1
			  AND project_id = $2
			  AND status IN ('requested', 'invited', 'enrolled')
		)
	`

	var enrolled bool
	err := s.db.QueryRow(query, volunteerID, projectID).Scan(&enrolled)
	if err != nil {
		return false, fmt.Errorf("failed to check enrollment status: %w", err)
	}

	return enrolled, nil
}
