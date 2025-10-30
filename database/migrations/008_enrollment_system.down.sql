-- Drop functions
DROP FUNCTION IF EXISTS is_volunteer_enrolled(UUID, UUID);
DROP FUNCTION IF EXISTS update_enrollment_status(UUID, VARCHAR, TEXT, UUID);
DROP FUNCTION IF EXISTS get_volunteer_enrollments(UUID);
DROP FUNCTION IF EXISTS get_project_enrollments(UUID);

-- Drop table
DROP TABLE IF EXISTS volunteer_enrollments;
