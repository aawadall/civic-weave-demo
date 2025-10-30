# Skills Matching System

## Overview

The Civic Weave skills matching system uses a combination of cosine similarity for skill matching and Haversine distance for geo-location to find the best volunteer candidates for projects.

## Algorithm Design

### 1. Skill Representation

Skills are represented as vectors where:

- **Volunteer Skills**: Boolean projection vector × proficiency score diagonal matrix
  - Each skill is either claimed (1) or not claimed (0)
  - Proficiency score ranges from [0, 1], starting at 0.5
  - Weighted vector = claimed × score (element-wise multiplication)

- **Project Skills**: Demand vector with weights
  - Each skill has a weight [0, 1] representing importance
  - Boolean flag for required vs. optional skills

Example:
```
Skills catalog: [JavaScript, Python, React, Design, Communication]

Volunteer:
  Claims: [1, 0, 1, 1, 0] (has JS, React, Design)
  Scores: [0.8, 0, 0.6, 0.7, 0]
  Weighted: [0.8, 0, 0.6, 0.7, 0]

Project:
  Demands: [0.9, 0.5, 1.0, 0.3, 0.6]
  (wants JS, Python, React heavily, Design and Communication less so)
```

### 2. Cosine Similarity

Cosine similarity measures the angle between two vectors, independent of magnitude:

```
cosine_similarity = (v1 · v2) / (||v1|| × ||v2||)

Where:
- v1 · v2 = dot product (sum of element-wise multiplication)
- ||v|| = magnitude (square root of sum of squared elements)
```

Result is in [0, 1] where:
- 0 = no skill overlap
- 1 = perfect skill match

Example calculation:
```
Volunteer weighted: [0.8, 0, 0.6, 0.7, 0]
Project demands:    [0.9, 0.5, 1.0, 0.3, 0.6]

Dot product = (0.8×0.9) + (0×0.5) + (0.6×1.0) + (0.7×0.3) + (0×0.6)
           = 0.72 + 0 + 0.6 + 0.21 + 0
           = 1.53

Magnitude vol = sqrt(0.64 + 0 + 0.36 + 0.49 + 0) = sqrt(1.49) = 1.22
Magnitude proj = sqrt(0.81 + 0.25 + 1.0 + 0.09 + 0.36) = sqrt(2.51) = 1.58

Cosine similarity = 1.53 / (1.22 × 1.58) = 1.53 / 1.93 = 0.79 (79% match)
```

### 3. Geo-location Distance

Uses Haversine formula to calculate great-circle distance between coordinates:

```
a = sin²(Δlat/2) + cos(lat1) × cos(lat2) × sin²(Δlon/2)
c = 2 × atan2(√a, √(1−a))
d = R × c

Where:
- R = Earth's radius (6371 km)
- lat1, lon1 = volunteer coordinates
- lat2, lon2 = project coordinates
- All angles in radians
```

Distance is then normalized:
```
distance_score = 1 - min(actual_distance / max_distance, 1)
```

### 4. Combined Scoring

Final match score combines both metrics with configurable weights:

```
combined_score = (skill_weight × cosine_similarity) + (distance_weight × distance_score)

Default weights:
- skill_weight = 0.7 (70%)
- distance_weight = 0.3 (30%)
```

Example:
```
Skill match: 0.79
Distance: 15 km
Max distance: 100 km
Distance score: 1 - (15/100) = 0.85

Combined = (0.7 × 0.79) + (0.3 × 0.85)
        = 0.553 + 0.255
        = 0.808 (80.8% overall match)
```

## Database Schema

### Skills Table
```sql
CREATE TABLE skills (
    id UUID PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    category VARCHAR(100),
    created_at TIMESTAMP
);
```

### Volunteer Skills Table
```sql
CREATE TABLE volunteer_skills (
    volunteer_id UUID REFERENCES users(id),
    skill_id UUID REFERENCES skills(id),
    claimed BOOLEAN DEFAULT TRUE,
    score DECIMAL(3,2) CHECK (score >= 0 AND score <= 1),
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    PRIMARY KEY (volunteer_id, skill_id)
);
```

### Project Skills Table
```sql
CREATE TABLE project_skills (
    project_id UUID REFERENCES projects(id),
    skill_id UUID REFERENCES skills(id),
    required BOOLEAN DEFAULT TRUE,
    weight DECIMAL(3,2) CHECK (weight >= 0 AND weight <= 1),
    PRIMARY KEY (project_id, skill_id)
);
```

### Users Table (Extended)
```sql
ALTER TABLE users ADD COLUMN latitude DECIMAL(10,8);
ALTER TABLE users ADD COLUMN longitude DECIMAL(11,8);
ALTER TABLE users ADD COLUMN location_name VARCHAR(255);
```

## API Endpoints

### Skills Management

**GET /api/skills**
- Returns all available skills in the catalog
- Query parameters:
  - `q` (optional): Search query for skill names/descriptions
  - `limit` (optional): Max results (default: 10 for search, all for no query)
- Response: `Skill[]`

**POST /api/skills**
- Creates a new skill dynamically
- Request body:
```json
{
  "name": "TypeScript",
  "description": "TypeScript programming language",
  "category": "Programming"
}
```
- Response: `Skill`
- Returns 409 Conflict if skill already exists

**GET /api/volunteers/:id/skills**
- Returns volunteer's claimed skills and proficiency scores
- Response: `VolunteerSkill[]`

**PUT /api/volunteers/:id/skills**
- Updates volunteer's skills
- Request body:
```json
{
  "skills": [
    {
      "skillId": "uuid",
      "claimed": true,
      "score": 0.75
    }
  ]
}
```

**PUT /api/volunteers/:id/location**
- Updates volunteer's geo-location
- Request body:
```json
{
  "latitude": 37.7749,
  "longitude": -122.4194,
  "locationName": "San Francisco, CA"
}
```

### Project Management

**GET /api/projects**
- Returns all projects
- Response: `Project[]`

**GET /api/projects/:id**
- Returns specific project details
- Response: `Project`

**GET /api/projects/:id/skills**
- Returns required skills for a project
- Response: `ProjectSkill[]`

### Matching

**GET /api/projects/:id/matches**
- Finds matching volunteers for a project
- Query parameters:
  - `skillWeight` (default: 0.7): Weight for skill matching [0, 1]
  - `distanceWeight` (default: 0.3): Weight for distance [0, 1]
  - `maxDistanceKm` (default: 100): Maximum distance in kilometers
  - `limit` (default: 20): Maximum results to return

- Response:
```json
[
  {
    "volunteerId": "uuid",
    "volunteerName": "John Doe",
    "email": "john@example.com",
    "skillScore": 0.79,
    "distanceKm": 15.2,
    "combinedScore": 0.808,
    "matchedSkills": ["skill-id-1", "skill-id-2"],
    "latitude": 37.7749,
    "longitude": -122.4194,
    "locationName": "San Francisco, CA"
  }
]
```

## Frontend Components

### Skills Page (`/skills`)
- **Autocomplete search** for finding existing skills
- **Dynamic skill creation** - type any skill name to create it
- **Chip-based UI** showing selected skills with remove buttons
- **Proficiency sliders** (0.0 - 1.0) for each skill
- Skills displayed as cards in a responsive grid
- Keyboard navigation (arrow keys, enter, escape)

### Projects Page (`/projects`)
- Lists all available projects
- Displays project location, dates, and status
- Click to view details

### Project Detail Page (`/projects/:id`)
- Shows project information
- Displays required skills with weights
- "Find Matches" button to run matching algorithm
- Displays top matching volunteers with:
  - Combined match score
  - Skill match percentage
  - Distance in kilometers
  - Matched skills list

## Automated Matching Cron Job

**Architecture Note:** In production, volunteer matching should be run as a scheduled cron job rather than on-demand to:
- Reduce API load
- Pre-compute matches for faster coordinator experience
- Enable batch processing optimizations
- Allow for A/B testing of matching algorithms

**Recommended Implementation:**
- **Python cron job** (for simplicity) running every 6-24 hours
- Reads project skill requirements from database
- Computes matches using same cosine similarity + Haversine logic
- Stores results in `project_volunteers` table with match scores
- Can be optimized with NumPy for vector operations

Example Python pseudocode:
```python
import numpy as np
from sklearn.metrics.pairwise import cosine_similarity

def run_matching_job():
    projects = get_active_projects()
    for project in projects:
        project_vector = get_project_skill_vector(project.id)
        volunteers = get_all_volunteers()

        matches = []
        for volunteer in volunteers:
            vol_vector = get_volunteer_skill_vector(volunteer.id)
            skill_sim = cosine_similarity([vol_vector], [project_vector])[0][0]
            distance = haversine_distance(project.coords, volunteer.coords)
            combined = 0.7 * skill_sim + 0.3 * (1 - distance/100)
            matches.append((volunteer.id, combined, skill_sim, distance))

        # Sort and save top matches
        top_matches = sorted(matches, key=lambda x: x[1], reverse=True)[:20]
        save_matches(project.id, top_matches)
```

## Usage Example

### 1. Volunteer Sets Up Skills

```typescript
// Search for existing skills or create new ones
const skill = await searchSkills('TypeScript')
// If not found, create it:
const newSkill = await createSkill({ name: 'TypeScript', category: 'Programming' })

// Add skills with proficiency scores
await updateVolunteerSkills(volunteerId, {
  skills: [
    { skillId: 'js-id', claimed: true, score: 0.8 },
    { skillId: 'react-id', claimed: true, score: 0.7 },
    { skillId: 'typescript-id', claimed: true, score: 0.6 }
  ]
})

// Sets location
await updateVolunteerLocation(volunteerId, {
  latitude: 37.7749,
  longitude: -122.4194,
  locationName: 'San Francisco, CA'
})
```

### 2. Coordinator Finds Matches

```typescript
// Find top 20 matches within 100km
// Prioritizing skills (70%) over distance (30%)
const matches = await findMatchesForProject(projectId, {
  skillWeight: 0.7,
  distanceWeight: 0.3,
  maxDistanceKm: 100,
  limit: 20
})

// Results sorted by combined score (highest first)
matches.forEach(match => {
  console.log(`${match.volunteerName}: ${(match.combinedScore * 100).toFixed(0)}%`)
  console.log(`  Skills: ${(match.skillScore * 100).toFixed(0)}%`)
  console.log(`  Distance: ${match.distanceKm.toFixed(1)} km`)
})
```

## Performance Considerations

1. **Indexing**: Skills and location columns are indexed for fast lookups
2. **Vector Caching**: Volunteer skill vectors could be cached
3. **Batch Processing**: Large-scale matching can be done asynchronously
4. **Filtering**: Applies max distance filter before computing full scores

## Future Enhancements

1. **Machine Learning**: Adjust scores based on successful placements
2. **Collaborative Filtering**: "Volunteers with similar skills also matched with..."
3. **Time-based Weighting**: Decay older project matches
4. **Skill Endorsements**: Peer validation of proficiency scores
5. **Availability Matching**: Include volunteer schedule in matching
6. **Historical Performance**: Track and use past project success rates
7. **Skill Synonyms**: Map similar skills (e.g., "JavaScript" and "JS")
8. **Skill Hierarchies**: Parent-child relationships (e.g., "React" under "Frontend")
9. **Auto-categorization**: Use NLP to automatically categorize new skills
10. **Batch Matching Cron**: Python-based scheduled job for pre-computing matches
