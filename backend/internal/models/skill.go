package models

import "time"

type Skill struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	Category    string    `json:"category"`
	CreatedAt   time.Time `json:"createdAt"`
}

type VolunteerSkill struct {
	VolunteerID string    `json:"volunteerId"`
	SkillID     string    `json:"skillId"`
	SkillName   string    `json:"skillName,omitempty"`
	Claimed     bool      `json:"claimed"`
	Score       float64   `json:"score"` // Proficiency score [0, 1]
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
}

type Project struct {
	ID            string     `json:"id"`
	Name          string     `json:"name"`
	Description   string     `json:"description"`
	CoordinatorID *string    `json:"coordinatorId,omitempty"`
	Latitude      *float64   `json:"latitude,omitempty"`
	Longitude     *float64   `json:"longitude,omitempty"`
	LocationName  *string    `json:"locationName,omitempty"`
	StartDate     *time.Time `json:"startDate,omitempty"`
	EndDate       *time.Time `json:"endDate,omitempty"`
	Status        string     `json:"status"`
	MaxVolunteers *int       `json:"maxVolunteers,omitempty"`
	CreatedAt     time.Time  `json:"createdAt"`
	UpdatedAt     time.Time  `json:"updatedAt"`
}

type ProjectSkill struct {
	ProjectID string  `json:"projectId"`
	SkillID   string  `json:"skillId"`
	SkillName string  `json:"skillName,omitempty"`
	Required  bool    `json:"required"`
	Weight    float64 `json:"weight"` // Demand weight [0, 1]
}

type VolunteerMatch struct {
	VolunteerID   string   `json:"volunteerId"`
	VolunteerName string   `json:"volunteerName"`
	Email         string   `json:"email"`
	SkillScore    float64  `json:"skillScore"`    // Cosine similarity score
	DistanceKm    float64  `json:"distanceKm"`    // Geo distance in km
	CombinedScore float64  `json:"combinedScore"` // Weighted combined score
	MatchedSkills []string `json:"matchedSkills"` // List of matching skills
	Latitude      *float64 `json:"latitude,omitempty"`
	Longitude     *float64 `json:"longitude,omitempty"`
	LocationName  *string  `json:"locationName,omitempty"`
}

type ProjectMatch struct {
	ProjectID     string   `json:"projectId"`
	ProjectName   string   `json:"projectName"`
	SkillScore    float64  `json:"skillScore"`
	DistanceKm    float64  `json:"distanceKm"`
	CombinedScore float64  `json:"combinedScore"`
	MatchedSkills []string `json:"matchedSkills"`
	Latitude      *float64 `json:"latitude,omitempty"`
	Longitude     *float64 `json:"longitude,omitempty"`
	LocationName  *string  `json:"locationName,omitempty"`
}

type UpdateSkillsRequest struct {
	Skills []struct {
		SkillID string  `json:"skillId"`
		Claimed bool    `json:"claimed"`
		Score   float64 `json:"score"`
	} `json:"skills"`
}

type UpdateLocationRequest struct {
	Latitude     float64 `json:"latitude"`
	Longitude    float64 `json:"longitude"`
	LocationName string  `json:"locationName"`
}

type CreateSkillRequest struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	Category    string `json:"category"`
}

type UpdateProjectSkillsRequest struct {
	Skills []struct {
		SkillID  string  `json:"skillId"`
		Required bool    `json:"required"`
		Weight   float64 `json:"weight"`
	} `json:"skills"`
}

type UpdateProjectRequest struct {
	Name         string   `json:"name"`
	Description  string   `json:"description"`
	Latitude     *float64 `json:"latitude,omitempty"`
	Longitude    *float64 `json:"longitude,omitempty"`
	LocationName *string  `json:"locationName,omitempty"`
}

type CreateProjectRequest struct {
	Name          string     `json:"name"`
	Description   string     `json:"description"`
	CoordinatorID *string    `json:"coordinatorId,omitempty"`
	Latitude      *float64   `json:"latitude,omitempty"`
	Longitude     *float64   `json:"longitude,omitempty"`
	LocationName  *string    `json:"locationName,omitempty"`
	StartDate     *time.Time `json:"startDate,omitempty"`
	EndDate       *time.Time `json:"endDate,omitempty"`
	MaxVolunteers *int       `json:"maxVolunteers,omitempty"`
}

type UpdateProjectStatusRequest struct {
	Status string `json:"status"`
}
