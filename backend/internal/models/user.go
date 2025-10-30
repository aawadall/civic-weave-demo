package models

import (
	"time"
)

type User struct {
	ID              string    `json:"id"`
	Email           string    `json:"email"`
	Name            string    `json:"name"`
	Role            string    `json:"role"`
	ProfileComplete bool      `json:"profileComplete"`
	Latitude        *float64  `json:"latitude,omitempty"`
	Longitude       *float64  `json:"longitude,omitempty"`
	LocationName    *string   `json:"locationName,omitempty"`
	CreatedAt       time.Time `json:"createdAt"`
	UpdatedAt       time.Time `json:"updatedAt"`
}

type LoginRequest struct {
	Email string `json:"email"`
}

type RegisterRequest struct {
	Email string `json:"email"`
	Name  string `json:"name"`
}
