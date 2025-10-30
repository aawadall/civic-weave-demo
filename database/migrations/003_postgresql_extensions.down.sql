-- Rollback PostgreSQL extensions

-- Drop materialized view
DROP MATERIALIZED VIEW IF EXISTS volunteer_skill_vectors;

-- Drop functions
DROP FUNCTION IF EXISTS find_matching_volunteers;
DROP FUNCTION IF EXISTS get_project_skill_vector;
DROP FUNCTION IF EXISTS get_volunteer_skill_vector;
DROP FUNCTION IF EXISTS skills_search_vector_update CASCADE;

-- Drop triggers
DROP TRIGGER IF EXISTS tsvector_update_skills ON skills;

-- Drop indexes
DROP INDEX IF EXISTS idx_skills_search_vector;
DROP INDEX IF EXISTS idx_projects_location_point;
DROP INDEX IF EXISTS idx_users_location_point;
DROP INDEX IF EXISTS idx_volunteer_skill_vectors_id;

-- Drop columns
ALTER TABLE skills DROP COLUMN IF EXISTS search_vector;
ALTER TABLE projects DROP COLUMN IF EXISTS location_point;
ALTER TABLE users DROP COLUMN IF EXISTS location_point;

-- Drop extensions (only if no other tables depend on them)
DROP EXTENSION IF EXISTS postgis CASCADE;
DROP EXTENSION IF EXISTS vector CASCADE;
