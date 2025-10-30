package skills

import (
	"database/sql"
	"errors"

	"github.com/civic-weave/backend/internal/models"
)

var (
	ErrSkillNotFound = errors.New("skill not found")
	ErrSkillExists   = errors.New("skill already exists")
)

type Service struct {
	db *sql.DB
}

func NewService(db *sql.DB) *Service {
	return &Service{db: db}
}

func (s *Service) CreateSkill(name, description, category string) (*models.Skill, error) {
	// Check if skill already exists
	var existingID string
	err := s.db.QueryRow("SELECT id FROM skills WHERE LOWER(name) = LOWER($1)", name).Scan(&existingID)
	if err == nil {
		return nil, ErrSkillExists
	}
	if err != sql.ErrNoRows {
		return nil, err
	}

	// Create new skill
	query := `
		INSERT INTO skills (name, description, category)
		VALUES ($1, $2, $3)
		RETURNING id, name, description, category, created_at
	`

	var skill models.Skill
	err = s.db.QueryRow(query, name, description, category).Scan(
		&skill.ID,
		&skill.Name,
		&skill.Description,
		&skill.Category,
		&skill.CreatedAt,
	)

	if err != nil {
		return nil, err
	}

	return &skill, nil
}

func (s *Service) SearchSkills(query string, limit int) ([]models.Skill, error) {
	if limit == 0 {
		limit = 10
	}

	// Use PostgreSQL full-text search with ranking
	// This is much faster and more flexible than LIKE queries
	sqlQuery := `
		SELECT
			id,
			name,
			description,
			category,
			created_at,
			ts_rank(search_vector, websearch_to_tsquery('english', $1)) as rank
		FROM skills
		WHERE search_vector @@ websearch_to_tsquery('english', $1)
		   OR LOWER(name) LIKE LOWER($2)
		ORDER BY
			CASE WHEN LOWER(name) LIKE LOWER($3) THEN 0 ELSE 1 END,
			rank DESC,
			name
		LIMIT $4
	`

	// websearch_to_tsquery handles spaces and common operators automatically
	searchPattern := "%" + query + "%"
	exactPattern := query + "%"

	rows, err := s.db.Query(sqlQuery, query, searchPattern, exactPattern, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var skills []models.Skill
	for rows.Next() {
		var skill models.Skill
		var rank float64 // ignore rank in results, just use for sorting

		err := rows.Scan(
			&skill.ID,
			&skill.Name,
			&skill.Description,
			&skill.Category,
			&skill.CreatedAt,
			&rank,
		)
		if err != nil {
			return nil, err
		}
		skills = append(skills, skill)
	}

	return skills, nil
}

func (s *Service) GetAllSkills() ([]models.Skill, error) {
	query := `
		SELECT id, name, description, category, created_at
		FROM skills
		ORDER BY category, name
	`

	rows, err := s.db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var skills []models.Skill
	for rows.Next() {
		var skill models.Skill
		err := rows.Scan(
			&skill.ID,
			&skill.Name,
			&skill.Description,
			&skill.Category,
			&skill.CreatedAt,
		)
		if err != nil {
			return nil, err
		}
		skills = append(skills, skill)
	}

	return skills, nil
}

func (s *Service) GetVolunteerSkills(volunteerID string) ([]models.VolunteerSkill, error) {
	query := `
		SELECT vs.volunteer_id, vs.skill_id, s.name, vs.claimed, vs.score, vs.created_at, vs.updated_at
		FROM volunteer_skills vs
		JOIN skills s ON vs.skill_id = s.id
		WHERE vs.volunteer_id = $1
		ORDER BY s.name
	`

	rows, err := s.db.Query(query, volunteerID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var volunteerSkills []models.VolunteerSkill
	for rows.Next() {
		var vs models.VolunteerSkill
		err := rows.Scan(
			&vs.VolunteerID,
			&vs.SkillID,
			&vs.SkillName,
			&vs.Claimed,
			&vs.Score,
			&vs.CreatedAt,
			&vs.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		volunteerSkills = append(volunteerSkills, vs)
	}

	return volunteerSkills, nil
}

func (s *Service) UpdateVolunteerSkills(volunteerID string, skills []struct {
	SkillID string
	Claimed bool
	Score   float64
}) error {
	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	for _, skill := range skills {
		// Validate score is in [0, 1]
		if skill.Score < 0 || skill.Score > 1 {
			return errors.New("skill score must be between 0 and 1")
		}

		query := `
			INSERT INTO volunteer_skills (volunteer_id, skill_id, claimed, score, updated_at)
			VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
			ON CONFLICT (volunteer_id, skill_id)
			DO UPDATE SET
				claimed = EXCLUDED.claimed,
				score = EXCLUDED.score,
				updated_at = CURRENT_TIMESTAMP
		`

		_, err := tx.Exec(query, volunteerID, skill.SkillID, skill.Claimed, skill.Score)
		if err != nil {
			return err
		}
	}

	return tx.Commit()
}

func (s *Service) UpdateVolunteerLocation(volunteerID string, lat, lon float64, locationName string) error {
	// Check if PostGIS is available
	var hasPostGIS bool
	err := s.db.QueryRow("SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'postgis')").Scan(&hasPostGIS)
	if err != nil {
		return err
	}

	var query string
	if hasPostGIS {
		// Update both lat/lon and PostGIS geography point if available
		query = `
			UPDATE users
			SET
				latitude = $1,
				longitude = $2,
				location_name = $3,
				location_point = ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography
			WHERE id = $4
		`
	} else {
		// Update just lat/lon if PostGIS not available
		query = `
			UPDATE users
			SET
				latitude = $1,
				longitude = $2,
				location_name = $3
			WHERE id = $4
		`
	}

	_, err = s.db.Exec(query, lat, lon, locationName, volunteerID)
	return err
}
