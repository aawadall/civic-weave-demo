-- Enhanced enrollment system with two-way approval
-- Drop and recreate volunteer_enrollments table with new structure
DROP TABLE IF EXISTS volunteer_enrollments;

CREATE TABLE IF NOT EXISTS volunteer_enrollments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    volunteer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    enrollment_type VARCHAR(20) NOT NULL, -- 'volunteer_request', 'tl_invitation'
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'withdrawn', 'completed'
    initiated_by UUID NOT NULL REFERENCES users(id), -- Who initiated the enrollment
    message TEXT, -- Optional message from initiator
    response_message TEXT, -- Optional response message
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    approved_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    
    -- Ensure unique volunteer-project pairs for active enrollments
    UNIQUE(volunteer_id, project_id)
);

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_volunteer_enrollments_volunteer_id ON volunteer_enrollments(volunteer_id);
CREATE INDEX IF NOT EXISTS idx_volunteer_enrollments_project_id ON volunteer_enrollments(project_id);
CREATE INDEX IF NOT EXISTS idx_volunteer_enrollments_status ON volunteer_enrollments(status);
CREATE INDEX IF NOT EXISTS idx_volunteer_enrollments_type ON volunteer_enrollments(enrollment_type);
CREATE INDEX IF NOT EXISTS idx_volunteer_enrollments_initiated_by ON volunteer_enrollments(initiated_by);

-- Create function to get active enrollments for a project
CREATE OR REPLACE FUNCTION get_project_enrollments(p_project_id UUID)
RETURNS TABLE (
    enrollment_id UUID,
    volunteer_id UUID,
    volunteer_name VARCHAR,
    volunteer_email VARCHAR,
    enrollment_type VARCHAR,
    status VARCHAR,
    initiated_by_name VARCHAR,
    message TEXT,
    response_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE,
    approved_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ve.id as enrollment_id,
        ve.volunteer_id,
        u.name as volunteer_name,
        u.email as volunteer_email,
        ve.enrollment_type,
        ve.status,
        initiator.name as initiated_by_name,
        ve.message,
        ve.response_message,
        ve.created_at,
        ve.approved_at
    FROM volunteer_enrollments ve
    JOIN users u ON u.id = ve.volunteer_id
    JOIN users initiator ON initiator.id = ve.initiated_by
    WHERE ve.project_id = p_project_id
    ORDER BY ve.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Create function to get enrollments for a volunteer
CREATE OR REPLACE FUNCTION get_volunteer_enrollments(p_volunteer_id UUID)
RETURNS TABLE (
    enrollment_id UUID,
    project_id UUID,
    project_name VARCHAR,
    enrollment_type VARCHAR,
    status VARCHAR,
    initiated_by_name VARCHAR,
    message TEXT,
    response_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE,
    approved_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ve.id as enrollment_id,
        ve.project_id,
        p.name as project_name,
        ve.enrollment_type,
        ve.status,
        initiator.name as initiated_by_name,
        ve.message,
        ve.response_message,
        ve.created_at,
        ve.approved_at
    FROM volunteer_enrollments ve
    JOIN projects p ON p.id = ve.project_id
    JOIN users initiator ON initiator.id = ve.initiated_by
    WHERE ve.volunteer_id = p_volunteer_id
    ORDER BY ve.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Create function to approve/reject enrollment
CREATE OR REPLACE FUNCTION update_enrollment_status(
    p_enrollment_id UUID,
    p_status VARCHAR,
    p_response_message TEXT DEFAULT NULL,
    p_updated_by UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
    enrollment_record RECORD;
BEGIN
    -- Get the enrollment record
    SELECT * INTO enrollment_record 
    FROM volunteer_enrollments 
    WHERE id = p_enrollment_id;
    
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;
    
    -- Update the status
    UPDATE volunteer_enrollments 
    SET 
        status = p_status,
        response_message = COALESCE(p_response_message, response_message),
        updated_at = NOW(),
        approved_at = CASE WHEN p_status = 'approved' THEN NOW() ELSE approved_at END
    WHERE id = p_enrollment_id;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Create function to check if volunteer is enrolled in project
CREATE OR REPLACE FUNCTION is_volunteer_enrolled(p_volunteer_id UUID, p_project_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM volunteer_enrollments 
        WHERE volunteer_id = p_volunteer_id 
          AND project_id = p_project_id 
          AND status IN ('approved', 'pending')
    );
END;
$$ LANGUAGE plpgsql;

-- Add some sample enrollments for testing
INSERT INTO volunteer_enrollments (volunteer_id, project_id, enrollment_type, status, initiated_by, message)
SELECT 
    u.id as volunteer_id,
    p.id as project_id,
    CASE 
        WHEN random() < 0.5 THEN 'volunteer_request'
        ELSE 'tl_invitation'
    END as enrollment_type,
    CASE 
        WHEN random() < 0.3 THEN 'approved'
        WHEN random() < 0.5 THEN 'rejected'
        ELSE 'pending'
    END as status,
    CASE 
        WHEN random() < 0.5 THEN u.id  -- Volunteer initiated
        ELSE (SELECT id FROM users WHERE role = 'coordinator' LIMIT 1)  -- TL initiated
    END as initiated_by,
    CASE 
        WHEN random() < 0.3 THEN 'I am very interested in this project!'
        WHEN random() < 0.6 THEN 'I have relevant experience in this area.'
        ELSE NULL
    END as message
FROM users u
CROSS JOIN projects p
WHERE u.role = 'volunteer' 
  AND p.status = 'active'
  AND random() < 0.15  -- 15% chance of enrollment
ON CONFLICT (volunteer_id, project_id) DO NOTHING;

-- Add comments
COMMENT ON TABLE volunteer_enrollments IS 'Two-way enrollment system: volunteer requests + TL approval, TL invitations + volunteer acceptance';
COMMENT ON COLUMN volunteer_enrollments.enrollment_type IS 'Type of enrollment: volunteer_request, tl_invitation';
COMMENT ON COLUMN volunteer_enrollments.status IS 'Enrollment status: pending, approved, rejected, withdrawn, completed';
COMMENT ON COLUMN volunteer_enrollments.initiated_by IS 'User who initiated the enrollment request';
COMMENT ON FUNCTION get_project_enrollments IS 'Get all enrollments for a specific project';
COMMENT ON FUNCTION get_volunteer_enrollments IS 'Get all enrollments for a specific volunteer';
COMMENT ON FUNCTION update_enrollment_status IS 'Update enrollment status (approve/reject)';
COMMENT ON FUNCTION is_volunteer_enrolled IS 'Check if volunteer is enrolled in project';
