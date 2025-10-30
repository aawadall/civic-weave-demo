-- Enable PostgreSQL extensions for performance optimization
-- pgvector: Vector similarity operations (cosine distance)
-- PostGIS: Geospatial queries (efficient distance calculations) - OPTIONAL
-- Full-text search: Better skill search with ranking

-- Enable pgvector extension for vector similarity (REQUIRED)
CREATE EXTENSION IF NOT EXISTS vector;

-- Try to enable PostGIS for geospatial queries (OPTIONAL - will use Haversine if not available)
DO $$
BEGIN
  -- Try to create PostGIS extension
  BEGIN
    CREATE EXTENSION IF NOT EXISTS postgis;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE 'PostGIS extension not available - geospatial queries will use Haversine formula';
  END;

  -- Only create geography columns if PostGIS is available
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'postgis') THEN
    -- Convert latitude/longitude to PostGIS geography points
    ALTER TABLE users ADD COLUMN IF NOT EXISTS location_point geography(POINT, 4326);
    ALTER TABLE projects ADD COLUMN IF NOT EXISTS location_point geography(POINT, 4326);

    -- Update existing location data to geography points
    UPDATE users
    SET location_point = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography
    WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

    UPDATE projects
    SET location_point = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography
    WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

    -- Create spatial indexes for fast distance queries
    CREATE INDEX IF NOT EXISTS idx_users_location_point ON users USING GIST(location_point);
    CREATE INDEX IF NOT EXISTS idx_projects_location_point ON projects USING GIST(location_point);

    RAISE NOTICE 'PostGIS enabled - using native geography functions for distance calculations';
  END IF;
END $$;

-- Add full-text search vector to skills table
ALTER TABLE skills ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Generate search vectors from name and description
UPDATE skills
SET search_vector =
  setweight(to_tsvector('english', COALESCE(name, '')), 'A') ||
  setweight(to_tsvector('english', COALESCE(description, '')), 'B') ||
  setweight(to_tsvector('english', COALESCE(category, '')), 'C');

-- Create GIN index for full-text search
CREATE INDEX IF NOT EXISTS idx_skills_search_vector ON skills USING GIN(search_vector);

-- Create trigger to automatically update search_vector on insert/update
CREATE OR REPLACE FUNCTION skills_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', COALESCE(NEW.name, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.category, '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tsvector_update_skills
BEFORE INSERT OR UPDATE ON skills
FOR EACH ROW EXECUTE FUNCTION skills_search_vector_update();

-- Create helper function for getting volunteer skill vector
-- Returns a vector of skill scores aligned by skill_id order
CREATE OR REPLACE FUNCTION get_volunteer_skill_vector(p_volunteer_id UUID, p_dimension INTEGER DEFAULT 1000)
RETURNS vector AS $$
DECLARE
  vector_string TEXT;
BEGIN
  -- Create a dense vector from volunteer's skills
  -- Uses skill_id hash modulo dimension for consistent positioning
  WITH skill_positions AS (
    SELECT
      (@ hashtext(vs.skill_id::text) % p_dimension) + 1 AS position,
      vs.score
    FROM volunteer_skills vs
    WHERE vs.volunteer_id = p_volunteer_id AND vs.claimed = TRUE
  ),
  all_positions AS (
    SELECT
      i,
      COALESCE(MAX(sp.score), 0) as value
    FROM generate_series(1, p_dimension) i
    LEFT JOIN skill_positions sp ON sp.position = i
    GROUP BY i
    ORDER BY i
  )
  SELECT '[' || string_agg(value::text, ',') || ']'
  INTO vector_string
  FROM all_positions;

  RETURN vector_string::vector;
END;
$$ LANGUAGE plpgsql;

-- Create helper function for getting project skill vector
CREATE OR REPLACE FUNCTION get_project_skill_vector(p_project_id UUID, p_dimension INTEGER DEFAULT 1000)
RETURNS vector AS $$
DECLARE
  vector_string TEXT;
BEGIN
  -- Create a dense vector from project's required skills
  WITH skill_positions AS (
    SELECT
      (@ hashtext(ps.skill_id::text) % p_dimension) + 1 AS position,
      ps.weight
    FROM project_skills ps
    WHERE ps.project_id = p_project_id
  ),
  all_positions AS (
    SELECT
      i,
      COALESCE(MAX(sp.weight), 0) as value
    FROM generate_series(1, p_dimension) i
    LEFT JOIN skill_positions sp ON sp.position = i
    GROUP BY i
    ORDER BY i
  )
  SELECT '[' || string_agg(value::text, ',') || ']'
  INTO vector_string
  FROM all_positions;

  RETURN vector_string::vector;
END;
$$ LANGUAGE plpgsql;

-- Create materialized view for pre-computed skill vectors (optional optimization)
-- This can be refreshed periodically by the cron job
CREATE MATERIALIZED VIEW IF NOT EXISTS volunteer_skill_vectors AS
SELECT
  id as volunteer_id,
  get_volunteer_skill_vector(id) as skill_vector
FROM users
WHERE role = 'volunteer';

CREATE INDEX IF NOT EXISTS idx_volunteer_skill_vectors_id ON volunteer_skill_vectors(volunteer_id);

-- Create helper function for Haversine distance (fallback when PostGIS not available)
CREATE OR REPLACE FUNCTION haversine_distance_km(
  lat1 DECIMAL,
  lon1 DECIMAL,
  lat2 DECIMAL,
  lon2 DECIMAL
)
RETURNS FLOAT AS $$
DECLARE
  earth_radius CONSTANT FLOAT := 6371.0;  -- Earth radius in km
  dlat FLOAT;
  dlon FLOAT;
  a FLOAT;
  c FLOAT;
BEGIN
  -- Convert to radians
  dlat := radians(lat2 - lat1);
  dlon := radians(lon2 - lon1);

  -- Haversine formula
  a := sin(dlat/2) * sin(dlat/2) +
       cos(radians(lat1)) * cos(radians(lat2)) *
       sin(dlon/2) * sin(dlon/2);
  c := 2 * atan2(sqrt(a), sqrt(1-a));

  RETURN earth_radius * c;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create function to find matching volunteers using native vector operations
-- Uses PostGIS if available, otherwise falls back to Haversine
CREATE OR REPLACE FUNCTION find_matching_volunteers(
  p_project_id UUID,
  p_skill_weight FLOAT DEFAULT 0.7,
  p_distance_weight FLOAT DEFAULT 0.3,
  p_max_distance_km FLOAT DEFAULT 100,
  p_limit INTEGER DEFAULT 20
)
RETURNS TABLE (
  volunteer_id UUID,
  volunteer_name VARCHAR,
  email VARCHAR,
  skill_score FLOAT,
  distance_km FLOAT,
  combined_score FLOAT,
  latitude DECIMAL,
  longitude DECIMAL,
  location_name VARCHAR
) AS $$
DECLARE
  has_postgis BOOLEAN;
BEGIN
  -- Check if PostGIS is available
  SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'postgis') INTO has_postgis;

  -- Use PostGIS if available, otherwise use Haversine
  IF has_postgis THEN
    RETURN QUERY
    WITH project_info AS (
      SELECT
        p.id,
        p.latitude as p_lat,
        p.longitude as p_lon,
        p.location_point,
        get_project_skill_vector(p.id) as project_vector
      FROM projects p
      WHERE p.id = p_project_id
    ),
    volunteer_matches AS (
      SELECT
        u.id,
        u.name,
        u.email,
        u.latitude,
        u.longitude,
        u.location_name,
        CASE
          WHEN vsv.skill_vector IS NOT NULL AND pi.project_vector IS NOT NULL THEN
            1 - (vsv.skill_vector <=> pi.project_vector)
          ELSE 0
        END AS skill_similarity,
        CASE
          WHEN u.location_point IS NOT NULL AND pi.location_point IS NOT NULL THEN
            ST_Distance(u.location_point, pi.location_point) / 1000
          ELSE NULL
        END AS distance
      FROM users u
      CROSS JOIN project_info pi
      LEFT JOIN volunteer_skill_vectors vsv ON vsv.volunteer_id = u.id
      WHERE u.role = 'volunteer'
    )
    SELECT
      vm.id,
      vm.name,
      vm.email,
      vm.skill_similarity,
      COALESCE(vm.distance, 0),
      (p_skill_weight * vm.skill_similarity) +
      (p_distance_weight * CASE
        WHEN vm.distance IS NOT NULL AND p_max_distance_km > 0 THEN
          GREATEST(0, 1 - (vm.distance / p_max_distance_km))
        ELSE 0.5
      END) AS combined,
      vm.latitude,
      vm.longitude,
      vm.location_name
    FROM volunteer_matches vm
    WHERE vm.distance IS NULL OR vm.distance <= p_max_distance_km
    ORDER BY combined DESC
    LIMIT p_limit;
  ELSE
    -- Fallback to Haversine formula
    RETURN QUERY
    WITH project_info AS (
      SELECT
        p.id,
        p.latitude as p_lat,
        p.longitude as p_lon,
        get_project_skill_vector(p.id) as project_vector
      FROM projects p
      WHERE p.id = p_project_id
    ),
    volunteer_matches AS (
      SELECT
        u.id,
        u.name,
        u.email,
        u.latitude,
        u.longitude,
        u.location_name,
        CASE
          WHEN vsv.skill_vector IS NOT NULL AND pi.project_vector IS NOT NULL THEN
            1 - (vsv.skill_vector <=> pi.project_vector)
          ELSE 0
        END AS skill_similarity,
        CASE
          WHEN u.latitude IS NOT NULL AND u.longitude IS NOT NULL
           AND pi.p_lat IS NOT NULL AND pi.p_lon IS NOT NULL THEN
            haversine_distance_km(u.latitude, u.longitude, pi.p_lat, pi.p_lon)
          ELSE NULL
        END AS distance
      FROM users u
      CROSS JOIN project_info pi
      LEFT JOIN volunteer_skill_vectors vsv ON vsv.volunteer_id = u.id
      WHERE u.role = 'volunteer'
    )
    SELECT
      vm.id,
      vm.name,
      vm.email,
      vm.skill_similarity,
      COALESCE(vm.distance, 0),
      (p_skill_weight * vm.skill_similarity) +
      (p_distance_weight * CASE
        WHEN vm.distance IS NOT NULL AND p_max_distance_km > 0 THEN
          GREATEST(0, 1 - (vm.distance / p_max_distance_km))
        ELSE 0.5
      END) AS combined,
      vm.latitude,
      vm.longitude,
      vm.location_name
    FROM volunteer_matches vm
    WHERE vm.distance IS NULL OR vm.distance <= p_max_distance_km
    ORDER BY combined DESC
    LIMIT p_limit;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Add comment documentation
COMMENT ON EXTENSION vector IS 'Vector similarity operations for skill matching';

-- Only comment on PostGIS if it exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'postgis') THEN
    EXECUTE 'COMMENT ON EXTENSION postgis IS ''Geospatial operations for location-based queries''';
  END IF;
END $$;

COMMENT ON FUNCTION haversine_distance_km IS 'Calculates great-circle distance between two points using Haversine formula';
COMMENT ON FUNCTION get_volunteer_skill_vector IS 'Converts volunteer skills to dense vector representation';
COMMENT ON FUNCTION get_project_skill_vector IS 'Converts project skill requirements to dense vector representation';
COMMENT ON FUNCTION find_matching_volunteers IS 'Finds best volunteer matches using vector similarity and geospatial distance (PostGIS if available, otherwise Haversine)';
COMMENT ON MATERIALIZED VIEW volunteer_skill_vectors IS 'Pre-computed skill vectors for faster matching. Refresh with: REFRESH MATERIALIZED VIEW volunteer_skill_vectors;';
