-- Drop functions
DROP FUNCTION IF EXISTS get_volunteer_matches(UUID, INTEGER);
DROP FUNCTION IF EXISTS get_project_matches(UUID, INTEGER);
DROP FUNCTION IF EXISTS refresh_all_matches();

-- Drop table
DROP TABLE IF EXISTS project_volunteer_matches;
