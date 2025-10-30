-- Generate 500 volunteer users with diverse skills and locations

-- Helper function to generate random location around San Francisco
CREATE OR REPLACE FUNCTION random_sf_location()
RETURNS TABLE(lat DECIMAL, lon DECIMAL, loc_name TEXT) AS $$
DECLARE
  -- San Francisco center
  center_lat DECIMAL := 37.7749;
  center_lon DECIMAL := -122.4194;
  -- Random offset within ~50km (approximately 0.5 degrees)
  offset_lat DECIMAL := (random() - 0.5) * 0.5;
  offset_lon DECIMAL := (random() - 0.5) * 0.5;
  neighborhoods TEXT[] := ARRAY[
    'Mission District', 'SOMA', 'Castro', 'Haight-Ashbury', 'Richmond',
    'Sunset', 'Marina', 'Pacific Heights', 'Nob Hill', 'Russian Hill',
    'Chinatown', 'North Beach', 'Potrero Hill', 'Dogpatch', 'Bernal Heights',
    'Glen Park', 'Excelsior', 'Visitacion Valley', 'Bayview', 'Hunters Point',
    'Oakland', 'Berkeley', 'San Mateo', 'Daly City', 'Millbrae',
    'Burlingame', 'San Bruno', 'South San Francisco', 'Pacifica', 'Half Moon Bay'
  ];
BEGIN
  RETURN QUERY SELECT
    center_lat + offset_lat,
    center_lon + offset_lon,
    neighborhoods[1 + floor(random() * array_length(neighborhoods, 1))::int] || ', CA';
END;
$$ LANGUAGE plpgsql;

-- Arrays of names for realistic volunteers
DO $$
DECLARE
  first_names TEXT[] := ARRAY[
    'Alex', 'Jordan', 'Taylor', 'Morgan', 'Casey', 'Riley', 'Avery', 'Quinn',
    'Blake', 'Drew', 'Cameron', 'Skyler', 'Dakota', 'Reese', 'Sage', 'River',
    'Phoenix', 'Rowan', 'Finley', 'Ellis', 'Emerson', 'Harper', 'Kennedy', 'Peyton',
    'Sam', 'Jamie', 'Devon', 'Charlie', 'Bailey', 'Kai', 'Lennon', 'Parker',
    'Maria', 'James', 'Emma', 'Michael', 'Sophia', 'William', 'Olivia', 'David',
    'Ava', 'Joseph', 'Isabella', 'Daniel', 'Mia', 'Matthew', 'Charlotte', 'Christopher',
    'Amelia', 'Andrew', 'Emily', 'Joshua', 'Abigail', 'Ryan', 'Madison', 'Nicholas',
    'Jennifer', 'Brandon', 'Jessica', 'Tyler', 'Sarah', 'Kevin', 'Hannah', 'Thomas',
    'Linda', 'Aaron', 'Ashley', 'Eric', 'Samantha', 'Jonathan', 'Elizabeth', 'Brian',
    'Priya', 'Raj', 'Ananya', 'Vikram', 'Aisha', 'Omar', 'Fatima', 'Mohammed',
    'Mei', 'Wei', 'Yuki', 'Hiroshi', 'Sofia', 'Carlos', 'Ana', 'Luis',
    'Grace', 'Ethan', 'Lily', 'Noah', 'Zoe', 'Lucas', 'Chloe', 'Mason'
  ];

  last_names TEXT[] := ARRAY[
    'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
    'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas',
    'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Thompson', 'White', 'Harris',
    'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson', 'Walker', 'Young', 'Allen',
    'Patel', 'Kumar', 'Singh', 'Sharma', 'Khan', 'Ali', 'Hassan', 'Ahmed',
    'Chen', 'Wang', 'Zhang', 'Liu', 'Yang', 'Huang', 'Zhao', 'Wu',
    'Kim', 'Park', 'Choi', 'Jung', 'Nguyen', 'Tran', 'Le', 'Pham',
    'Cohen', 'Levy', 'Rosenberg', 'Goldberg', 'O''Brien', 'Murphy', 'Kelly', 'Sullivan',
    'Santos', 'Silva', 'Costa', 'Alves', 'Ivanov', 'Petrov', 'Sokolov', 'Popov'
  ];

  volunteer_count INTEGER := 500;
  i INTEGER;
  v_id UUID;
  v_email TEXT;
  v_name TEXT;
  v_lat DECIMAL;
  v_lon DECIMAL;
  v_loc TEXT;

  -- Skill selection
  skill_ids UUID[];
  skill_count INTEGER;
  selected_skill_id UUID;
  proficiency DECIMAL;

BEGIN
  -- Get all skill IDs
  SELECT array_agg(id) INTO skill_ids FROM skills;

  -- Generate 500 volunteers
  FOR i IN 1..volunteer_count LOOP
    -- Generate name
    v_name := first_names[1 + floor(random() * array_length(first_names, 1))::int] || ' ' ||
              last_names[1 + floor(random() * array_length(last_names, 1))::int];

    -- Generate email (sanitize for uniqueness)
    v_email := lower(replace(v_name, ' ', '.')) || '.' || i || '@volunteers.org';

    -- Get random location
    SELECT * INTO v_lat, v_lon, v_loc FROM random_sf_location();

    -- Insert volunteer user
    INSERT INTO users (email, name, role, profile_complete, latitude, longitude, location_name)
    VALUES (v_email, v_name, 'volunteer', true, v_lat, v_lon, v_loc::VARCHAR)
    RETURNING id INTO v_id;

    -- Assign random number of skills (2 to 8 skills per volunteer)
    skill_count := 2 + floor(random() * 7)::int;

    -- Randomly select and assign skills
    FOR j IN 1..skill_count LOOP
      -- Pick a random skill
      selected_skill_id := skill_ids[1 + floor(random() * array_length(skill_ids, 1))::int];

      -- Generate proficiency score
      -- Distribution: 20% beginners (0.3-0.5), 60% intermediate (0.5-0.7), 20% advanced (0.7-1.0)
      CASE
        WHEN random() < 0.2 THEN
          proficiency := 0.3 + (random() * 0.2); -- Beginners: 0.3-0.5
        WHEN random() < 0.8 THEN
          proficiency := 0.5 + (random() * 0.2); -- Intermediate: 0.5-0.7
        ELSE
          proficiency := 0.7 + (random() * 0.3); -- Advanced: 0.7-1.0
      END CASE;

      -- Round to 2 decimal places
      proficiency := round(proficiency::numeric, 2);

      -- Insert skill (ignore duplicates)
      INSERT INTO volunteer_skills (volunteer_id, skill_id, claimed, score)
      VALUES (v_id, selected_skill_id, true, proficiency)
      ON CONFLICT (volunteer_id, skill_id) DO NOTHING;
    END LOOP;

    -- Log progress every 100 volunteers
    IF i % 100 = 0 THEN
      RAISE NOTICE 'Generated % volunteers...', i;
    END IF;
  END LOOP;

  RAISE NOTICE 'Successfully generated % volunteers with diverse skills!', volunteer_count;
END $$;

-- Clean up helper function
DROP FUNCTION random_sf_location();

-- Update statistics
ANALYZE users;
ANALYZE volunteer_skills;

-- Refresh materialized view with new volunteers
REFRESH MATERIALIZED VIEW volunteer_skill_vectors;

-- Show summary
DO $$
DECLARE
  total_volunteers INTEGER;
  total_skills_assigned INTEGER;
  avg_skills_per_volunteer DECIMAL;
BEGIN
  SELECT COUNT(*) INTO total_volunteers FROM users WHERE role = 'volunteer';
  SELECT COUNT(*) INTO total_skills_assigned FROM volunteer_skills;
  SELECT ROUND(AVG(skill_count), 2) INTO avg_skills_per_volunteer
  FROM (
    SELECT COUNT(*) as skill_count
    FROM volunteer_skills
    GROUP BY volunteer_id
  ) sub;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'Volunteer Generation Summary:';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Total Volunteers: %', total_volunteers;
  RAISE NOTICE 'Total Skills Assigned: %', total_skills_assigned;
  RAISE NOTICE 'Avg Skills per Volunteer: %', avg_skills_per_volunteer;
  RAISE NOTICE '========================================';
END $$;
