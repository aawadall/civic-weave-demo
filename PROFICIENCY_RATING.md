# Volunteer Proficiency Rating System

## Overview

This document describes how skill proficiency ratings work in Civic Weave, separating volunteer self-assessment from team lead validation.

## How It Works

### For Volunteers

**What volunteers can do:**
- Add skills they possess using the search/autocomplete interface
- Create new skills if they don't exist
- Remove skills they no longer want to claim
- View their skills as simple chips (name, category, description)

**What volunteers CANNOT do:**
- Rate their own proficiency levels
- See proficiency scores (until rated by team leads)
- Adjust skill weights

**Default behavior:**
- When a volunteer claims a skill, it's automatically saved with a **default proficiency score of 0.5**
- This neutral score (0.0 = beginner, 1.0 = expert) ensures:
  - They appear in matching results for projects requiring that skill
  - Their score is neutral until validated by a team lead
  - They're not penalized for claiming unrated skills

### For Team Leads (Coordinators)

**When team leads can rate volunteers:**
- After a project is completed/closed
- For volunteers who worked with them on that project
- Based on actual observed performance

**Rating process (to be implemented):**
1. Team Lead closes a project
2. System shows list of volunteers who participated
3. Team Lead rates each volunteer's demonstrated skills (0.0 - 1.0)
4. Ratings update the volunteer's skill proficiency scores
5. Updated scores improve future matching accuracy

**Rating scale:**
- 0.0-0.2: Beginner (learning the skill)
- 0.3-0.4: Basic (can perform simple tasks)
- 0.5-0.6: Intermediate (default, competent performer)
- 0.7-0.8: Advanced (highly skilled)
- 0.9-1.0: Expert (mastery level)

## Database Schema

### volunteer_skills Table

```sql
CREATE TABLE volunteer_skills (
  volunteer_id UUID REFERENCES users(id),
  skill_id UUID REFERENCES skills(id),
  claimed BOOLEAN DEFAULT TRUE,
  score DECIMAL(3,2) CHECK (score >= 0 AND score <= 1),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (volunteer_id, skill_id)
);
```

**Fields:**
- `claimed`: TRUE when volunteer adds the skill
- `score`: Proficiency level (0.0 - 1.0)
  - Defaults to 0.5 when volunteer claims skill
  - Updated by team leads after project completion
- `updated_at`: Tracks when last rated

## API Endpoints

### Current (Volunteer Self-Management)

**Get volunteer's skills:**
```
GET /api/volunteers/{id}/skills
```

**Update volunteer's skills:**
```
PUT /api/volunteers/{id}/skills
Body: {
  "skills": [
    { "skillId": "uuid", "claimed": true, "score": 0.5 }
  ]
}
```
*Note: Volunteers use this to claim/unclaim skills with default score*

### Future (Team Lead Rating)

**Rate volunteer after project (to be implemented):**
```
PUT /api/projects/{projectId}/volunteers/{volunteerId}/ratings
Body: {
  "ratings": [
    { "skillId": "uuid", "score": 0.8 },
    { "skillId": "uuid", "score": 0.6 }
  ]
}
```

**Get volunteers for project completion:**
```
GET /api/projects/{projectId}/volunteers
```

## Matching Algorithm Impact

The volunteer's skill proficiency scores directly impact matching:

### Skill Vector Calculation

For a volunteer with skills:
- JavaScript (score: 0.8)
- Python (score: 0.5)
- React (score: 0.7)

Their skill vector uses these scores:
```
[0, 0, ..., 0.8, ..., 0.5, ..., 0.7, ..., 0]
```

### Cosine Similarity

Higher proficiency scores = stronger matches with projects requiring those skills:
- Volunteer with Python=0.9 scores higher than Python=0.5
- Unrated skills (0.5) still contribute to matching
- Team lead ratings make matching more accurate over time

## UI Implementation Status

### ✅ Implemented (Volunteers)
- Skill claiming via autocomplete search
- Chip-based display of claimed skills
- Adding/removing skills
- Default score of 0.5 on claim

### 🔜 To Be Implemented (Team Leads)
- Project completion workflow
- Volunteer rating interface
- Skill proficiency sliders (for TL only)
- Rating history/audit trail
- Bulk rating of multiple volunteers
- Rating notifications to volunteers

## Future Enhancements

1. **Rating History**: Track changes to proficiency scores over time
2. **Multiple Ratings**: Average ratings from multiple team leads
3. **Skill Decay**: Reduce scores over time if not used
4. **Self-Assessment vs Team Rating**: Show both and calculate weighted average
5. **Skill Endorsements**: Allow other volunteers to endorse skills
6. **Certification Integration**: Auto-set scores based on verified certificates

## Example Workflow

1. **Volunteer claims skills:**
   - Sarah adds "Python", "Data Analysis", "Teaching"
   - All saved with score = 0.5

2. **Volunteer matches to project:**
   - Project needs: Python (0.7 weight), Data Analysis (0.8 weight)
   - Sarah matches because she has both (even with default 0.5 scores)

3. **Volunteer participates:**
   - Works on data cleaning and analysis tasks
   - Teaches other volunteers Python basics

4. **Project closes:**
   - Team Lead rates Sarah:
     - Python: 0.8 (demonstrated strong Python skills)
     - Data Analysis: 0.7 (good analytical thinking)
     - Teaching: 0.9 (excellent at explaining concepts)

5. **Future matching improves:**
   - Sarah now scores higher for Python/Teaching projects
   - Her profile more accurately reflects demonstrated abilities
   - Projects get better volunteer matches

## Benefits

1. **Prevents Volunteer Anxiety**: No pressure to self-assess accurately
2. **Objective Ratings**: Based on actual project performance
3. **Improves Over Time**: Each project refines the volunteer's profile
4. **Better Matching**: More accurate scores = better project fits
5. **Skill Development Tracking**: Volunteers can see growth over time
6. **Trust Building**: External validation builds credibility

## Notes

- Initial default score of 0.5 ensures new volunteers aren't penalized
- Team leads should rate soon after project completion while fresh
- Volunteers can always add/remove skills regardless of ratings
- Ratings are specific to skills demonstrated in that project
- Multiple ratings for same skill should be averaged
