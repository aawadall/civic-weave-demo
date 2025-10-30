package models

import "time"

type Enrollment struct {
	ID              string     `json:"id"`
	VolunteerID     string     `json:"volunteerId"`
	ProjectID       string     `json:"projectId"`
	Status          string     `json:"status"` // "requested", "invited", "enrolled", "tl_rejected", "v_rejected"
	InitiatedBy     string     `json:"initiatedBy"`
	Message         *string    `json:"message,omitempty"`
	ResponseMessage *string    `json:"responseMessage,omitempty"`
	CreatedAt       time.Time  `json:"createdAt"`
	UpdatedAt       time.Time  `json:"updatedAt"`
	ApprovedAt      *time.Time `json:"approvedAt,omitempty"`
	CompletedAt     *time.Time `json:"completedAt,omitempty"`
}

type EnrollmentWithDetails struct {
	Enrollment
	VolunteerName   string `json:"volunteerName"`
	VolunteerEmail  string `json:"volunteerEmail"`
	ProjectName     string `json:"projectName"`
	InitiatedByName string `json:"initiatedByName"`
}

type CreateEnrollmentRequest struct {
	ProjectID   string  `json:"projectId"`
	Action      string  `json:"action"`                // "request" (volunteer) or "invite" (TL)
	VolunteerID *string `json:"volunteerId,omitempty"` // required for "invite" action
	Message     *string `json:"message,omitempty"`
}

type UpdateEnrollmentRequest struct {
	Action          string  `json:"action"` // "accept", "reject" or "withdraw"
	ResponseMessage *string `json:"responseMessage,omitempty"`
}
