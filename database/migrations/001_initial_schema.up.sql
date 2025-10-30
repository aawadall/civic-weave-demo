-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'volunteer',
    profile_complete BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Insert default users
INSERT INTO users (email, name, role, profile_complete) VALUES
    ('admin@civicweave.org', 'Admin User', 'admin', TRUE),
    ('coordinator@civicweave.org', 'Coordinator User', 'coordinator', TRUE),
    ('volunteer@civicweave.org', 'Volunteer User', 'volunteer', TRUE)
ON CONFLICT (email) DO NOTHING;
