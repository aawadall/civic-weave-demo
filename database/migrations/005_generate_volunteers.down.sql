-- Remove generated volunteers and their skills

-- Delete volunteer skills for generated volunteers
DELETE FROM volunteer_skills
WHERE volunteer_id IN (
  SELECT id FROM users
  WHERE role = 'volunteer'
    AND email LIKE '%@volunteers.org'
);

-- Delete generated volunteer users
DELETE FROM users
WHERE role = 'volunteer'
  AND email LIKE '%@volunteers.org';

-- Refresh materialized view
REFRESH MATERIALIZED VIEW volunteer_skill_vectors;

-- Show cleanup summary
DO $$
DECLARE
  remaining_volunteers INTEGER;
BEGIN
  SELECT COUNT(*) INTO remaining_volunteers FROM users WHERE role = 'volunteer';
  RAISE NOTICE 'Cleanup complete. Remaining volunteers: %', remaining_volunteers;
END $$;
