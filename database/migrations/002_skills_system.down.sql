-- Drop tables in reverse order (respect foreign keys)
DROP TABLE IF EXISTS project_volunteers;
DROP TABLE IF EXISTS project_skills;
DROP TABLE IF EXISTS projects;
DROP TABLE IF EXISTS volunteer_skills;
DROP TABLE IF EXISTS skills;

-- Remove columns from users
ALTER TABLE users DROP COLUMN IF EXISTS latitude;
ALTER TABLE users DROP COLUMN IF EXISTS longitude;
ALTER TABLE users DROP COLUMN IF EXISTS location_name;
