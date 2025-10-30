-- Add sample projects for demonstration

-- Insert sample projects
INSERT INTO projects (name, description, coordinator_id, latitude, longitude, location_name, start_date, end_date, status, max_volunteers) VALUES
    (
        'Community Garden Setup',
        'Help set up a community garden in the Mission District. We need volunteers to help with planning, construction, and initial planting. This is a great opportunity to learn about urban agriculture and community organizing.',
        (SELECT id FROM users WHERE role = 'coordinator' LIMIT 1),
        37.7599,
        -122.4148,
        'Mission District, San Francisco, CA',
        CURRENT_TIMESTAMP + INTERVAL '7 days',
        CURRENT_TIMESTAMP + INTERVAL '30 days',
        'active',
        15
    ),
    (
        'Youth Coding Workshop',
        'Teach basic programming to middle school students. We''ll cover Python basics, simple games, and web development. Looking for volunteers with teaching experience and programming skills.',
        (SELECT id FROM users WHERE role = 'coordinator' LIMIT 1),
        37.7833,
        -122.4167,
        'Downtown San Francisco, CA',
        CURRENT_TIMESTAMP + INTERVAL '14 days',
        CURRENT_TIMESTAMP + INTERVAL '60 days',
        'active',
        8
    ),
    (
        'Food Bank Organization',
        'Help organize and distribute food to families in need. Tasks include sorting donations, packing boxes, and coordinating pickup schedules. Great for volunteers who want to make an immediate impact.',
        (SELECT id FROM users WHERE role = 'coordinator' LIMIT 1),
        37.7749,
        -122.4194,
        'San Francisco, CA',
        CURRENT_TIMESTAMP + INTERVAL '3 days',
        CURRENT_TIMESTAMP + INTERVAL '90 days',
        'active',
        20
    ),
    (
        'Senior Tech Support',
        'Provide technology assistance to seniors. Help them set up devices, use video calls, navigate social media, and stay connected with family. Patient and friendly volunteers needed.',
        (SELECT id FROM users WHERE role = 'coordinator' LIMIT 1),
        37.7899,
        -122.3999,
        'SOMA, San Francisco, CA',
        CURRENT_TIMESTAMP + INTERVAL '10 days',
        CURRENT_TIMESTAMP + INTERVAL '120 days',
        'active',
        10
    ),
    (
        'Environmental Data Analysis',
        'Analyze environmental data collected from local parks. We need volunteers with data analysis skills to help identify trends and create visualizations for community presentations.',
        (SELECT id FROM users WHERE role = 'coordinator' LIMIT 1),
        37.7694,
        -122.4862,
        'Golden Gate Park, San Francisco, CA',
        CURRENT_TIMESTAMP + INTERVAL '21 days',
        CURRENT_TIMESTAMP + INTERVAL '45 days',
        'active',
        5
    );

-- Add skill requirements for each project

-- Community Garden Setup skills
INSERT INTO project_skills (project_id, skill_id, required, weight)
SELECT
    p.id,
    s.id,
    CASE WHEN s.name IN ('Project Management', 'Event Planning') THEN TRUE ELSE FALSE END,
    CASE
        WHEN s.name = 'Project Management' THEN 0.8
        WHEN s.name = 'Event Planning' THEN 0.7
        WHEN s.name = 'Communication' THEN 0.6
        ELSE 0.5
    END
FROM projects p, skills s
WHERE p.name = 'Community Garden Setup'
  AND s.name IN ('Project Management', 'Event Planning', 'Communication', 'Graphic Design');

-- Youth Coding Workshop skills
INSERT INTO project_skills (project_id, skill_id, required, weight)
SELECT
    p.id,
    s.id,
    CASE WHEN s.name IN ('Teaching', 'Python', 'JavaScript') THEN TRUE ELSE FALSE END,
    CASE
        WHEN s.name = 'Teaching' THEN 0.9
        WHEN s.name = 'Python' THEN 0.8
        WHEN s.name = 'JavaScript' THEN 0.7
        WHEN s.name = 'React' THEN 0.6
        ELSE 0.5
    END
FROM projects p, skills s
WHERE p.name = 'Youth Coding Workshop'
  AND s.name IN ('Teaching', 'Python', 'JavaScript', 'React', 'Communication');

-- Food Bank Organization skills
INSERT INTO project_skills (project_id, skill_id, required, weight)
SELECT
    p.id,
    s.id,
    FALSE, -- No hard requirements, just helpful skills
    CASE
        WHEN s.name = 'Event Planning' THEN 0.7
        WHEN s.name = 'Project Management' THEN 0.6
        ELSE 0.5
    END
FROM projects p, skills s
WHERE p.name = 'Food Bank Organization'
  AND s.name IN ('Event Planning', 'Project Management', 'Communication');

-- Senior Tech Support skills
INSERT INTO project_skills (project_id, skill_id, required, weight)
SELECT
    p.id,
    s.id,
    CASE WHEN s.name IN ('Teaching', 'Communication') THEN TRUE ELSE FALSE END,
    CASE
        WHEN s.name = 'Communication' THEN 0.9
        WHEN s.name = 'Teaching' THEN 0.8
        WHEN s.name = 'JavaScript' THEN 0.4
        ELSE 0.5
    END
FROM projects p, skills s
WHERE p.name = 'Senior Tech Support'
  AND s.name IN ('Teaching', 'Communication', 'Social Media', 'JavaScript');

-- Environmental Data Analysis skills
INSERT INTO project_skills (project_id, skill_id, required, weight)
SELECT
    p.id,
    s.id,
    CASE WHEN s.name IN ('Database Design', 'Python') THEN TRUE ELSE FALSE END,
    CASE
        WHEN s.name = 'Python' THEN 0.9
        WHEN s.name = 'Database Design' THEN 0.8
        WHEN s.name = 'Graphic Design' THEN 0.6
        ELSE 0.5
    END
FROM projects p, skills s
WHERE p.name = 'Environmental Data Analysis'
  AND s.name IN ('Python', 'Database Design', 'Graphic Design', 'Content Writing');
