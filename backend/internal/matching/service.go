package matching

import (
	"database/sql"
	"fmt"
	"log"
	"math"

	"github.com/civic-weave/backend/internal/models"
	"github.com/lib/pq"
)

type Service struct {
	db *sql.DB
}

func NewService(db *sql.DB) *Service {
	return &Service{db: db}
}

// SkillVector represents a skill vector with skill IDs and their weighted scores
type SkillVector map[string]float64

// GetVolunteerSkillVector returns the weighted skill vector for a volunteer
// Vector = claimed × score (element-wise multiplication)
func (s *Service) GetVolunteerSkillVector(volunteerID string) (SkillVector, error) {
	query := `
		SELECT skill_id, claimed, score
		FROM volunteer_skills
		WHERE volunteer_id = $1 AND claimed = TRUE
	`

	rows, err := s.db.Query(query, volunteerID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	vector := make(SkillVector)
	for rows.Next() {
		var skillID string
		var claimed bool
		var score float64

		if err := rows.Scan(&skillID, &claimed, &score); err != nil {
			return nil, err
		}

		// Weighted value: claimed (1.0) × score
		if claimed {
			vector[skillID] = score
		}
	}

	return vector, nil
}

// GetProjectSkillVector returns the weighted skill demand vector for a project
func (s *Service) GetProjectSkillVector(projectID string) (SkillVector, error) {
	query := `
		SELECT skill_id, weight
		FROM project_skills
		WHERE project_id = $1
	`

	rows, err := s.db.Query(query, projectID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	vector := make(SkillVector)
	for rows.Next() {
		var skillID string
		var weight float64

		if err := rows.Scan(&skillID, &weight); err != nil {
			return nil, err
		}

		vector[skillID] = weight
	}

	return vector, nil
}

// CosineSimilarity calculates cosine similarity between two skill vectors
// Returns value in [0, 1] where 1 is perfect match
func CosineSimilarity(v1, v2 SkillVector) float64 {
	if len(v1) == 0 || len(v2) == 0 {
		return 0.0
	}

	var dotProduct, magnitude1, magnitude2 float64

	// Calculate dot product and magnitudes
	for skillID, val1 := range v1 {
		magnitude1 += val1 * val1
		if val2, exists := v2[skillID]; exists {
			dotProduct += val1 * val2
		}
	}

	for _, val2 := range v2 {
		magnitude2 += val2 * val2
	}

	magnitude1 = math.Sqrt(magnitude1)
	magnitude2 = math.Sqrt(magnitude2)

	if magnitude1 == 0 || magnitude2 == 0 {
		return 0.0
	}

	similarity := dotProduct / (magnitude1 * magnitude2)

	// Clamp to [0, 1] to handle floating point errors
	if similarity < 0 {
		similarity = 0
	} else if similarity > 1 {
		similarity = 1
	}

	return similarity
}

// HaversineDistance calculates the distance in kilometers between two coordinates
func HaversineDistance(lat1, lon1, lat2, lon2 float64) float64 {
	const earthRadiusKm = 6371.0

	// Convert to radians
	lat1Rad := lat1 * math.Pi / 180
	lon1Rad := lon1 * math.Pi / 180
	lat2Rad := lat2 * math.Pi / 180
	lon2Rad := lon2 * math.Pi / 180

	// Haversine formula
	dLat := lat2Rad - lat1Rad
	dLon := lon2Rad - lon1Rad

	a := math.Sin(dLat/2)*math.Sin(dLat/2) +
		math.Cos(lat1Rad)*math.Cos(lat2Rad)*
			math.Sin(dLon/2)*math.Sin(dLon/2)

	c := 2 * math.Atan2(math.Sqrt(a), math.Sqrt(1-a))

	return earthRadiusKm * c
}

// FindMatchingVolunteers finds and ranks volunteers for a project
// Uses cached matches from project_volunteer_matches table
func (s *Service) FindMatchingVolunteers(
	projectID string,
	skillWeight float64,
	distanceWeight float64,
	maxDistanceKm float64,
	limit int,
) ([]models.VolunteerMatch, error) {
	// Default values
	if limit == 0 {
		limit = 20
	}

	// Use cached matches from the batch processing table
	query := `
		SELECT
			volunteer_id,
			volunteer_name,
			email,
			skill_score,
			distance_km,
			combined_score,
			matched_skills,
			latitude,
			longitude,
			location_name
		FROM get_project_matches($1, $2)
	`

	rows, err := s.db.Query(query, projectID, limit)
	if err != nil {
		// Fallback to on-demand matching if cached matches are not available
		log.Printf("Cached matches not available, falling back to on-demand matching: %v", err)
		return s.findMatchingVolunteersOnDemand(projectID, skillWeight, distanceWeight, maxDistanceKm, limit)
	}
	defer rows.Close()

	log.Printf("DEBUG: Query executed successfully for project %s with limit %d", projectID, limit)
	matches := make([]models.VolunteerMatch, 0)

	for rows.Next() {
		var match models.VolunteerMatch
		var lat, lon *float64
		var matchedSkills []string

		err := rows.Scan(
			&match.VolunteerID,
			&match.VolunteerName,
			&match.Email,
			&match.SkillScore,
			&match.DistanceKm,
			&match.CombinedScore,
			pq.Array(&matchedSkills),
			&lat,
			&lon,
			&match.LocationName,
		)
		if err != nil {
			continue
		}

		match.Latitude = lat
		match.Longitude = lon
		if matchedSkills == nil {
			matchedSkills = []string{}
		}
		match.MatchedSkills = matchedSkills

		matches = append(matches, match)
	}

	log.Printf("DEBUG: Found %d matches for project %s", len(matches), projectID)
	return matches, nil
}

// findMatchingVolunteersOnDemand provides fallback on-demand matching
func (s *Service) findMatchingVolunteersOnDemand(
	projectID string,
	skillWeight float64,
	distanceWeight float64,
	maxDistanceKm float64,
	limit int,
) ([]models.VolunteerMatch, error) {
	// Default weights
	if skillWeight == 0 && distanceWeight == 0 {
		skillWeight = 0.7
		distanceWeight = 0.3
	}

	// Normalize weights
	totalWeight := skillWeight + distanceWeight
	skillWeight /= totalWeight
	distanceWeight /= totalWeight

	// Default values
	if maxDistanceKm == 0 {
		maxDistanceKm = 100
	}
	if limit == 0 {
		limit = 20
	}

	// Use PostgreSQL native function for matching
	query := `
		SELECT
			volunteer_id,
			volunteer_name,
			email,
			skill_score,
			distance_km,
			combined_score,
			latitude,
			longitude,
			location_name
		FROM find_matching_volunteers($1, $2, $3, $4, $5)
	`

	rows, err := s.db.Query(query, projectID, skillWeight, distanceWeight, maxDistanceKm, limit)
	if err != nil {
		return nil, fmt.Errorf("failed to find matches: %w", err)
	}
	defer rows.Close()

	var matches []models.VolunteerMatch

	for rows.Next() {
		var match models.VolunteerMatch
		var lat, lon *float64

		err := rows.Scan(
			&match.VolunteerID,
			&match.VolunteerName,
			&match.Email,
			&match.SkillScore,
			&match.DistanceKm,
			&match.CombinedScore,
			&lat,
			&lon,
			&match.LocationName,
		)
		if err != nil {
			continue
		}

		match.Latitude = lat
		match.Longitude = lon

		// Get matched skills for display
		matchedSkills, _ := s.getMatchedSkillNames(match.VolunteerID, projectID)
		if matchedSkills == nil {
			matchedSkills = []string{} // Ensure it's never null
		}
		match.MatchedSkills = matchedSkills

		matches = append(matches, match)
	}

	return matches, nil
}

// getMatchedSkillNames returns skill IDs that exist in both volunteer and project
func (s *Service) getMatchedSkillNames(volunteerID, projectID string) ([]string, error) {
	query := `
		SELECT DISTINCT s.id
		FROM volunteer_skills vs
		JOIN project_skills ps ON vs.skill_id = ps.skill_id
		JOIN skills s ON vs.skill_id = s.id
		WHERE vs.volunteer_id = $1
		  AND ps.project_id = $2
		  AND vs.claimed = TRUE
		ORDER BY s.name
	`

	rows, err := s.db.Query(query, volunteerID, projectID)
	if err != nil {
		return []string{}, err // Return empty slice instead of nil
	}
	defer rows.Close()

	var skillIDs []string
	for rows.Next() {
		var skillID string
		if err := rows.Scan(&skillID); err != nil {
			continue
		}
		skillIDs = append(skillIDs, skillID)
	}

	// Ensure we always return a slice, never nil
	if skillIDs == nil {
		skillIDs = []string{}
	}
	return skillIDs, nil
}

// RefreshSkillVectors refreshes the materialized view of skill vectors
// Should be called periodically (e.g., by cron job after volunteer updates)
func (s *Service) RefreshSkillVectors() error {
	_, err := s.db.Exec("REFRESH MATERIALIZED VIEW volunteer_skill_vectors")
	return err
}

// getMatchedSkills returns skill IDs that exist in both vectors
func getMatchedSkills(v1, v2 SkillVector) []string {
	var matched []string
	for skillID := range v1 {
		if _, exists := v2[skillID]; exists {
			matched = append(matched, skillID)
		}
	}
	return matched
}

// sortMatchesByScore sorts matches by combined score in descending order
func sortMatchesByScore(matches []models.VolunteerMatch) {
	for i := 0; i < len(matches)-1; i++ {
		for j := i + 1; j < len(matches); j++ {
			if matches[j].CombinedScore > matches[i].CombinedScore {
				matches[i], matches[j] = matches[j], matches[i]
			}
		}
	}
}

// FindMatchingProjects finds and ranks projects for a volunteer
// Uses cached matches from project_volunteer_matches table
func (s *Service) FindMatchingProjects(
	volunteerID string,
	skillWeight float64,
	distanceWeight float64,
	maxDistanceKm float64,
	limit int,
) ([]models.ProjectMatch, error) {
	if limit == 0 {
		limit = 20
	}

	// Use cached matches from the batch processing table
	query := `
        SELECT
            project_id,
            project_name,
            skill_score,
            distance_km,
            combined_score,
            matched_skills,
            latitude,
            longitude,
            location_name
        FROM get_volunteer_matches($1, $2)
    `

	rows, err := s.db.Query(query, volunteerID, limit)
	if err != nil {
		// Fallback to on-demand matching if cached matches are not available
		log.Printf("Cached matches not available for volunteer, falling back to on-demand matching: %v", err)
		return s.findMatchingProjectsOnDemand(volunteerID, skillWeight, distanceWeight, maxDistanceKm, limit)
	}
	defer rows.Close()

	matches := make([]models.ProjectMatch, 0)
	for rows.Next() {
		var match models.ProjectMatch
		var lat, lon *float64
		var matchedSkills []string

		err := rows.Scan(
			&match.ProjectID,
			&match.ProjectName,
			&match.SkillScore,
			&match.DistanceKm,
			&match.CombinedScore,
			pq.Array(&matchedSkills),
			&lat,
			&lon,
			&match.LocationName,
		)
		if err != nil {
			continue
		}

		match.Latitude = lat
		match.Longitude = lon
		if matchedSkills == nil {
			matchedSkills = []string{}
		}
		match.MatchedSkills = matchedSkills

		matches = append(matches, match)
	}

	return matches, nil
}

// findMatchingProjectsOnDemand provides fallback on-demand matching for volunteers
func (s *Service) findMatchingProjectsOnDemand(
	volunteerID string,
	skillWeight float64,
	distanceWeight float64,
	maxDistanceKm float64,
	limit int,
) ([]models.ProjectMatch, error) {
	if limit == 0 {
		limit = 20
	}

	// Simple fallback - return active projects
	query := `
        SELECT 
            p.id,
            p.name,
            0.5 AS skill_score,
            0.0 AS distance_km,
            0.5 AS combined_score,
            p.latitude,
            p.longitude,
            p.location_name
        FROM projects p
        WHERE p.status = 'active'
        ORDER BY p.name
        LIMIT $1
    `

	rows, err := s.db.Query(query, limit)
	if err != nil {
		return nil, fmt.Errorf("failed to find project matches: %w", err)
	}
	defer rows.Close()

	var matches []models.ProjectMatch
	for rows.Next() {
		var match models.ProjectMatch
		var lat, lon *float64

		err := rows.Scan(
			&match.ProjectID,
			&match.ProjectName,
			&match.SkillScore,
			&match.DistanceKm,
			&match.CombinedScore,
			&lat,
			&lon,
			&match.LocationName,
		)
		if err != nil {
			continue
		}

		match.Latitude = lat
		match.Longitude = lon
		match.MatchedSkills = []string{}

		matches = append(matches, match)
	}

	return matches, nil
}
