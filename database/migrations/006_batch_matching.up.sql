-- Create table for storing pre-computed volunteer-project matches
CREATE TABLE IF NOT EXISTS project_volunteer_matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    volunteer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    skill_score DECIMAL(5,4) NOT NULL DEFAULT 0.0,
    distance_km DECIMAL(10,2) NOT NULL DEFAULT 0.0,
    combined_score DECIMAL(5,4) NOT NULL DEFAULT 0.0,
    matched_skills TEXT[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure unique project-volunteer pairs
    UNIQUE(project_id, volunteer_id)
);

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_project_volunteer_matches_project_id ON project_volunteer_matches(project_id);
CREATE INDEX IF NOT EXISTS idx_project_volunteer_matches_volunteer_id ON project_volunteer_matches(volunteer_id);
CREATE INDEX IF NOT EXISTS idx_project_volunteer_matches_combined_score ON project_volunteer_matches(combined_score DESC);

-- Create function to refresh all matches with tiered matching
CREATE OR REPLACE FUNCTION refresh_all_matches()
RETURNS INTEGER AS $$
DECLARE
    match_count INTEGER := 0;
BEGIN
    -- Clear existing matches
    DELETE FROM project_volunteer_matches;
    
    -- Insert new matches using tiered matching logic
    -- Tier 1: Exclude already enrolled volunteers
    -- Tier 2: Prioritize geo distance (with national exception)
    -- Tier 3: Match skills last
    INSERT INTO project_volunteer_matches (project_id, volunteer_id, skill_score, distance_km, combined_score, matched_skills)
    WITH volunteer_project_combinations AS (
        SELECT 
            p.id as project_id,
            u.id as volunteer_id,
            p.latitude as p_lat,
            p.longitude as p_lon,
            u.latitude as u_lat,
            u.longitude as u_lon,
            p.location_name as p_location,
            u.location_name as u_location,
            COALESCE(1 - (vsv.skill_vector <=> get_project_skill_vector(p.id)), 0) as skill_score,
            CASE 
                WHEN p.latitude IS NOT NULL AND p.longitude IS NOT NULL AND u.latitude IS NOT NULL AND u.longitude IS NOT NULL THEN
                    6371 * 2 * ASIN(
                        LEAST(1, SQRT(
                            POWER(SIN(RADIANS((p.latitude::double precision) - (u.latitude::double precision)) / 2), 2) +
                            COS(RADIANS(u.latitude::double precision)) * COS(RADIANS(p.latitude::double precision)) *
                            POWER(SIN(RADIANS((p.longitude::double precision) - (u.longitude::double precision)) / 2), 2)
                        ))
                    )
                ELSE 999999  -- Very large distance for volunteers without location
            END as distance_km,
            ARRAY(
                SELECT s.name 
                FROM volunteer_skills vs 
                JOIN project_skills ps ON vs.skill_id = ps.skill_id 
                JOIN skills s ON vs.skill_id = s.id 
                WHERE vs.volunteer_id = u.id AND ps.project_id = p.id AND vs.claimed = TRUE
            ) as matched_skills
        FROM projects p
        CROSS JOIN users u
        LEFT JOIN volunteer_skill_vectors vsv ON vsv.volunteer_id = u.id
        WHERE p.status = 'active' 
          AND u.role = 'volunteer'
          AND u.latitude IS NOT NULL 
          AND u.longitude IS NOT NULL
          -- Tier 1: Exclude already enrolled volunteers
          AND NOT EXISTS (
              SELECT 1 FROM volunteer_enrollments ve 
              WHERE ve.volunteer_id = u.id 
                AND ve.project_id = p.id 
                AND ve.status = 'active'
          )
    ),
    tiered_matches AS (
        SELECT 
            project_id,
            volunteer_id,
            skill_score,
            distance_km,
            matched_skills,
            -- Tier 2: Geo distance priority (with national exception)
            CASE 
                -- National exception: if both locations contain "Canada" or same country, prioritize by skills
                WHEN (p_location ILIKE '%Canada%' AND u_location ILIKE '%Canada%') 
                  OR (p_location ILIKE '%Ontario%' AND u_location ILIKE '%Ontario%')
                  OR (p_location ILIKE '%Alberta%' AND u_location ILIKE '%Alberta%')
                  OR (p_location ILIKE '%British Columbia%' AND u_location ILIKE '%British Columbia%')
                  OR (p_location ILIKE '%Quebec%' AND u_location ILIKE '%Quebec%')
                  OR (p_location ILIKE '%Manitoba%' AND u_location ILIKE '%Manitoba%')
                  OR (p_location ILIKE '%Saskatchewan%' AND u_location ILIKE '%Saskatchewan%')
                  OR (p_location ILIKE '%Nova Scotia%' AND u_location ILIKE '%Nova Scotia%')
                  OR (p_location ILIKE '%New Brunswick%' AND u_location ILIKE '%New Brunswick%')
                  OR (p_location ILIKE '%Newfoundland%' AND u_location ILIKE '%Newfoundland%')
                  OR (p_location ILIKE '%Prince Edward Island%' AND u_location ILIKE '%Prince Edward Island%')
                  OR (p_location ILIKE '%Northwest Territories%' AND u_location ILIKE '%Northwest Territories%')
                  OR (p_location ILIKE '%Yukon%' AND u_location ILIKE '%Yukon%')
                  OR (p_location ILIKE '%Nunavut%' AND u_location ILIKE '%Nunavut%')
                THEN 
                    -- For national/same province: prioritize skills (70%) over distance (30%)
                    0.7 * skill_score + 0.3 * GREATEST(0, 1 - (distance_km / 100))
                ELSE
                    -- For different regions: prioritize distance (60%) over skills (40%)
                    0.4 * skill_score + 0.6 * GREATEST(0, 1 - (distance_km / 100))
            END as combined_score
        FROM volunteer_project_combinations
        WHERE distance_km <= 500  -- Maximum 500km radius
    )
    SELECT 
        project_id,
        volunteer_id,
        skill_score,
        distance_km,
        combined_score,
        matched_skills
    FROM tiered_matches
    WHERE combined_score > 0.1  -- Minimum threshold for matches
    ORDER BY combined_score DESC;
    
    GET DIAGNOSTICS match_count = ROW_COUNT;
    
    -- Update the updated_at timestamp
    UPDATE project_volunteer_matches SET updated_at = NOW();
    
    RETURN match_count;
END;
$$ LANGUAGE plpgsql;

-- Create function to get matches for a project
CREATE OR REPLACE FUNCTION get_project_matches(p_project_id UUID, p_limit INTEGER DEFAULT 20)
RETURNS TABLE (
    volunteer_id UUID,
    volunteer_name VARCHAR,
    email VARCHAR,
    skill_score DECIMAL(5,4),
    distance_km DECIMAL(10,2),
    combined_score DECIMAL(5,4),
    matched_skills TEXT[],
    latitude DECIMAL(10,8),
    longitude DECIMAL(11,8),
    location_name VARCHAR
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        u.id as volunteer_id,
        u.name as volunteer_name,
        u.email,
        pvm.skill_score,
        pvm.distance_km,
        pvm.combined_score,
        pvm.matched_skills,
        u.latitude,
        u.longitude,
        u.location_name
    FROM project_volunteer_matches pvm
    JOIN users u ON u.id = pvm.volunteer_id
    WHERE pvm.project_id = p_project_id
    ORDER BY pvm.combined_score DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Create function to get matches for a volunteer
CREATE OR REPLACE FUNCTION get_volunteer_matches(p_volunteer_id UUID, p_limit INTEGER DEFAULT 20)
RETURNS TABLE (
    project_id UUID,
    project_name VARCHAR,
    skill_score DECIMAL(5,4),
    distance_km DECIMAL(10,2),
    combined_score DECIMAL(5,4),
    matched_skills TEXT[],
    latitude DECIMAL(10,8),
    longitude DECIMAL(11,8),
    location_name VARCHAR
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id as project_id,
        p.name as project_name,
        pvm.skill_score,
        pvm.distance_km,
        pvm.combined_score,
        pvm.matched_skills,
        p.latitude,
        p.longitude,
        p.location_name
    FROM project_volunteer_matches pvm
    JOIN projects p ON p.id = pvm.project_id
    WHERE pvm.volunteer_id = p_volunteer_id
      AND p.status = 'active'
    ORDER BY pvm.combined_score DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Add comments
COMMENT ON TABLE project_volunteer_matches IS 'Pre-computed matches between projects and volunteers for fast retrieval';
COMMENT ON FUNCTION refresh_all_matches IS 'Refreshes all project-volunteer matches using current data';
COMMENT ON FUNCTION get_project_matches IS 'Gets cached matches for a specific project';
COMMENT ON FUNCTION get_volunteer_matches IS 'Gets cached matches for a specific volunteer';
