package auth

import (
	"database/sql"
	"errors"
	"time"

	"github.com/civic-weave/backend/internal/models"
)

var (
	ErrUserNotFound = errors.New("user not found")
	ErrUserExists   = errors.New("user already exists")
)

type Service struct {
	db *sql.DB
}

func NewService(db *sql.DB) *Service {
	return &Service{db: db}
}

func (s *Service) GetAllUsers() ([]models.User, error) {
	query := `
		SELECT id, email, name, role, profile_complete, latitude, longitude, location_name, created_at, updated_at
		FROM users
		ORDER BY created_at DESC
	`

	rows, err := s.db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var users []models.User
	for rows.Next() {
		var user models.User
		err := rows.Scan(
			&user.ID,
			&user.Email,
			&user.Name,
			&user.Role,
			&user.ProfileComplete,
			&user.Latitude,
			&user.Longitude,
			&user.LocationName,
			&user.CreatedAt,
			&user.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		users = append(users, user)
	}

	return users, nil
}

func (s *Service) GetUserByEmail(email string) (*models.User, error) {
	query := `
		SELECT id, email, name, role, profile_complete, latitude, longitude, location_name, created_at, updated_at
		FROM users
		WHERE email = $1
	`

	var user models.User
	err := s.db.QueryRow(query, email).Scan(
		&user.ID,
		&user.Email,
		&user.Name,
		&user.Role,
		&user.ProfileComplete,
		&user.Latitude,
		&user.Longitude,
		&user.LocationName,
		&user.CreatedAt,
		&user.UpdatedAt,
	)

	if err == sql.ErrNoRows {
		return nil, ErrUserNotFound
	}
	if err != nil {
		return nil, err
	}

	return &user, nil
}

func (s *Service) RegisterVolunteer(name, email string) (*models.User, error) {
	// Check if user already exists
	existing, err := s.GetUserByEmail(email)
	if err == nil && existing != nil {
		return nil, ErrUserExists
	}

	query := `
		INSERT INTO users (email, name, role, profile_complete)
		VALUES ($1, $2, 'volunteer', FALSE)
		RETURNING id, email, name, role, profile_complete, created_at, updated_at
	`

	var user models.User
	err = s.db.QueryRow(query, email, name).Scan(
		&user.ID,
		&user.Email,
		&user.Name,
		&user.Role,
		&user.ProfileComplete,
		&user.CreatedAt,
		&user.UpdatedAt,
	)

	if err != nil {
		return nil, err
	}

	return &user, nil
}

func (s *Service) CreateDefaultUsers() error {
	defaultUsers := []struct {
		email string
		name  string
		role  string
	}{
		{"admin@civicweave.org", "Admin User", "admin"},
		{"coordinator@civicweave.org", "Coordinator User", "coordinator"},
		{"volunteer@civicweave.org", "Volunteer User", "volunteer"},
	}

	for _, u := range defaultUsers {
		_, err := s.GetUserByEmail(u.email)
		if err == ErrUserNotFound {
			query := `
				INSERT INTO users (email, name, role, profile_complete, created_at, updated_at)
				VALUES ($1, $2, $3, TRUE, $4, $4)
			`
			_, err := s.db.Exec(query, u.email, u.name, u.role, time.Now())
			if err != nil {
				return err
			}
		}
	}

	return nil
}
