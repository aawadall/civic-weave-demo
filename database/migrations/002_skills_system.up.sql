-- Skills catalog table
CREATE TABLE IF NOT EXISTS skills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    category VARCHAR(100),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Index on skill name for fast lookups
CREATE INDEX IF NOT EXISTS idx_skills_name ON skills(name);
CREATE INDEX IF NOT EXISTS idx_skills_category ON skills(category);

-- Volunteer skills table (boolean claims + proficiency scores)
CREATE TABLE IF NOT EXISTS volunteer_skills (
    volunteer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    skill_id UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
    claimed BOOLEAN NOT NULL DEFAULT TRUE,
    score DECIMAL(3, 2) NOT NULL DEFAULT 0.5 CHECK (score >= 0 AND score <= 1),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (volunteer_id, skill_id)
);

CREATE INDEX IF NOT EXISTS idx_volunteer_skills_volunteer ON volunteer_skills(volunteer_id);
CREATE INDEX IF NOT EXISTS idx_volunteer_skills_skill ON volunteer_skills(skill_id);

-- Add geo-location to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8);
ALTER TABLE users ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8);
ALTER TABLE users ADD COLUMN IF NOT EXISTS location_name VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_users_location ON users(latitude, longitude);

-- Projects table
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    coordinator_id UUID REFERENCES users(id) ON DELETE SET NULL,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    location_name VARCHAR(255),
    start_date TIMESTAMP,
    end_date TIMESTAMP,
    status VARCHAR(50) NOT NULL DEFAULT 'draft',
    max_volunteers INTEGER,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_projects_coordinator ON projects(coordinator_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_location ON projects(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_projects_dates ON projects(start_date, end_date);

-- Project skill demands
CREATE TABLE IF NOT EXISTS project_skills (
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    skill_id UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
    required BOOLEAN NOT NULL DEFAULT TRUE,
    weight DECIMAL(3, 2) NOT NULL DEFAULT 1.0 CHECK (weight >= 0 AND weight <= 1),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (project_id, skill_id)
);

CREATE INDEX IF NOT EXISTS idx_project_skills_project ON project_skills(project_id);
CREATE INDEX IF NOT EXISTS idx_project_skills_skill ON project_skills(skill_id);

-- Project volunteer assignments
CREATE TABLE IF NOT EXISTS project_volunteers (
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    volunteer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL DEFAULT 'invited',
    match_score DECIMAL(5, 4),
    assigned_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (project_id, volunteer_id)
);

CREATE INDEX IF NOT EXISTS idx_project_volunteers_project ON project_volunteers(project_id);
CREATE INDEX IF NOT EXISTS idx_project_volunteers_volunteer ON project_volunteers(volunteer_id);
CREATE INDEX IF NOT EXISTS idx_project_volunteers_status ON project_volunteers(status);

-- Insert sample skills
INSERT INTO skills (name, description, category) VALUES
    ('JavaScript', 'JavaScript programming language', 'Programming'),
    ('Python', 'Python programming language', 'Programming'),
    ('React', 'React.js framework', 'Frontend'),
    ('Node.js', 'Node.js runtime', 'Backend'),
    ('Database Design', 'Database schema and query design', 'Data'),
    ('Project Management', 'Managing projects and teams', 'Management'),
    ('Communication', 'Effective communication skills', 'Soft Skills'),
    ('Teaching', 'Teaching and mentoring', 'Education'),
    ('Event Planning', 'Planning and organizing events', 'Coordination'),
    ('Graphic Design', 'Visual design and graphics', 'Design'),
    ('Content Writing', 'Writing articles and content', 'Communication'),
    ('Social Media', 'Social media management', 'Marketing'),
    ('Fundraising', 'Raising funds for causes', 'Finance'),
    ('Legal Advice', 'Legal consultation', 'Legal'),
    ('Medical Care', 'Healthcare and medical support', 'Healthcare')
ON CONFLICT (name) DO NOTHING;

-- Update existing users with sample locations (San Francisco area)
UPDATE users SET
    latitude = 37.7749,
    longitude = -122.4194,
    location_name = 'San Francisco, CA'
WHERE location_name IS NULL;
