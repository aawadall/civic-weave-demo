-- Remove sample projects and their skill requirements

-- Delete project skills (cascades from projects deletion, but explicit is clearer)
DELETE FROM project_skills
WHERE project_id IN (
    SELECT id FROM projects
    WHERE name IN (
        'Community Garden Setup',
        'Youth Coding Workshop',
        'Food Bank Organization',
        'Senior Tech Support',
        'Environmental Data Analysis'
    )
);

-- Delete sample projects
DELETE FROM projects
WHERE name IN (
    'Community Garden Setup',
    'Youth Coding Workshop',
    'Food Bank Organization',
    'Senior Tech Support',
    'Environmental Data Analysis'
);
