package projects

import (
	"database/sql"
	"errors"
	"time"

	"github.com/civic-weave/backend/internal/models"
)

var (
	ErrProjectNotFound = errors.New("project not found")
)

type Service struct {
	db *sql.DB
}

func NewService(db *sql.DB) *Service {
	return &Service{db: db}
}

func (s *Service) GetAllProjects() ([]models.Project, error) {
	query := `
		SELECT id, name, description, coordinator_id, latitude, longitude,
		       location_name, start_date, end_date, status, max_volunteers,
		       created_at, updated_at
		FROM projects
		ORDER BY created_at DESC
	`

	rows, err := s.db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var projects []models.Project
	for rows.Next() {
		var p models.Project
		err := rows.Scan(
			&p.ID,
			&p.Name,
			&p.Description,
			&p.CoordinatorID,
			&p.Latitude,
			&p.Longitude,
			&p.LocationName,
			&p.StartDate,
			&p.EndDate,
			&p.Status,
			&p.MaxVolunteers,
			&p.CreatedAt,
			&p.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		projects = append(projects, p)
	}

	return projects, nil
}

func (s *Service) GetProject(projectID string) (*models.Project, error) {
	query := `
		SELECT id, name, description, coordinator_id, latitude, longitude,
		       location_name, start_date, end_date, status, max_volunteers,
		       created_at, updated_at
		FROM projects
		WHERE id = $1
	`

	var p models.Project
	err := s.db.QueryRow(query, projectID).Scan(
		&p.ID,
		&p.Name,
		&p.Description,
		&p.CoordinatorID,
		&p.Latitude,
		&p.Longitude,
		&p.LocationName,
		&p.StartDate,
		&p.EndDate,
		&p.Status,
		&p.MaxVolunteers,
		&p.CreatedAt,
		&p.UpdatedAt,
	)

	if err == sql.ErrNoRows {
		return nil, ErrProjectNotFound
	}
	if err != nil {
		return nil, err
	}

	return &p, nil
}

func (s *Service) CreateProject(name, description string, coordinatorID *string, lat, lon *float64, locationName *string, startDate, endDate *time.Time, maxVolunteers *int) (*models.Project, error) {
	query := `
        INSERT INTO projects (name, description, coordinator_id, latitude, longitude, location_name, start_date, end_date, max_volunteers, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'draft')
		RETURNING id, name, description, coordinator_id, latitude, longitude, location_name, start_date, end_date, status, max_volunteers, created_at, updated_at
	`

	var p models.Project
	err := s.db.QueryRow(query, name, description, coordinatorID, lat, lon, locationName, startDate, endDate, maxVolunteers).Scan(
		&p.ID,
		&p.Name,
		&p.Description,
		&p.CoordinatorID,
		&p.Latitude,
		&p.Longitude,
		&p.LocationName,
		&p.StartDate,
		&p.EndDate,
		&p.Status,
		&p.MaxVolunteers,
		&p.CreatedAt,
		&p.UpdatedAt,
	)

	if err != nil {
		return nil, err
	}

	return &p, nil
}

func (s *Service) GetProjectSkills(projectID string) ([]models.ProjectSkill, error) {
	query := `
		SELECT ps.project_id, ps.skill_id, s.name, ps.required, ps.weight
		FROM project_skills ps
		JOIN skills s ON ps.skill_id = s.id
		WHERE ps.project_id = $1
		ORDER BY s.name
	`

	rows, err := s.db.Query(query, projectID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var projectSkills []models.ProjectSkill
	for rows.Next() {
		var ps models.ProjectSkill
		err := rows.Scan(
			&ps.ProjectID,
			&ps.SkillID,
			&ps.SkillName,
			&ps.Required,
			&ps.Weight,
		)
		if err != nil {
			return nil, err
		}
		projectSkills = append(projectSkills, ps)
	}

	return projectSkills, nil
}

func (s *Service) SetProjectSkills(projectID string, skills []struct {
	SkillID  string
	Required bool
	Weight   float64
}) error {
	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	// Delete existing skills
	_, err = tx.Exec("DELETE FROM project_skills WHERE project_id = $1", projectID)
	if err != nil {
		return err
	}

	// Insert new skills
	for _, skill := range skills {
		// Validate weight is in [0, 1]
		if skill.Weight < 0 || skill.Weight > 1 {
			return errors.New("skill weight must be between 0 and 1")
		}

		query := `
			INSERT INTO project_skills (project_id, skill_id, required, weight)
			VALUES ($1, $2, $3, $4)
		`

		_, err := tx.Exec(query, projectID, skill.SkillID, skill.Required, skill.Weight)
		if err != nil {
			return err
		}
	}

	return tx.Commit()
}

func (s *Service) UpdateProjectDetails(projectID string, name, description string, lat, lon *float64, locationName *string) error {
	query := `
        UPDATE projects
        SET
            name = COALESCE(NULLIF($1, ''), name),
            description = COALESCE(NULLIF($2, ''), description),
            latitude = COALESCE($3, latitude),
            longitude = COALESCE($4, longitude),
            location_name = COALESCE($5, location_name),
            updated_at = NOW()
        WHERE id = $6
    `
	_, err := s.db.Exec(query, name, description, lat, lon, locationName, projectID)
	return err
}

func (s *Service) UpdateProjectStatus(projectID string, status string) error {
	query := `
        UPDATE projects
        SET status = $1,
            updated_at = NOW()
        WHERE id = $2
    `
	_, err := s.db.Exec(query, status, projectID)
	return err
}
