-- Create table to track volunteer enrollments in projects
CREATE TABLE IF NOT EXISTS volunteer_enrollments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    volunteer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'active', -- active, completed, withdrawn
    enrolled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure unique volunteer-project pairs
    UNIQUE(volunteer_id, project_id)
);

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_volunteer_enrollments_volunteer_id ON volunteer_enrollments(volunteer_id);
CREATE INDEX IF NOT EXISTS idx_volunteer_enrollments_project_id ON volunteer_enrollments(project_id);
CREATE INDEX IF NOT EXISTS idx_volunteer_enrollments_status ON volunteer_enrollments(status);

-- Add some sample enrollments for testing
INSERT INTO volunteer_enrollments (volunteer_id, project_id, status)
SELECT 
    u.id as volunteer_id,
    p.id as project_id,
    'active' as status
FROM users u
CROSS JOIN projects p
WHERE u.role = 'volunteer' 
  AND p.status = 'active'
  AND random() < 0.1  -- 10% chance of enrollment
ON CONFLICT (volunteer_id, project_id) DO NOTHING;

-- Add comments
COMMENT ON TABLE volunteer_enrollments IS 'Tracks volunteer enrollments in projects to avoid duplicate matching';
COMMENT ON COLUMN volunteer_enrollments.status IS 'Enrollment status: active, completed, withdrawn';
