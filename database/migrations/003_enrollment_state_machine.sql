-- Migration: Implement enrollment state machine
-- States: requested, invited, enrolled, tl_rejected, v_rejected
-- (undefined state = no enrollment record exists)

BEGIN;

-- Step 1: Add new status column
ALTER TABLE volunteer_enrollments
ADD COLUMN new_status VARCHAR(20);

-- Step 2: Migrate existing data to new states
-- volunteer_request + pending -> requested
UPDATE volunteer_enrollments
SET new_status = 'requested'
WHERE enrollment_type = 'volunteer_request' AND status = 'pending';

-- volunteer_request + approved -> enrolled
UPDATE volunteer_enrollments
SET new_status = 'enrolled'
WHERE enrollment_type = 'volunteer_request' AND status = 'approved';

-- volunteer_request + rejected -> tl_rejected
UPDATE volunteer_enrollments
SET new_status = 'tl_rejected'
WHERE enrollment_type = 'volunteer_request' AND status = 'rejected';

-- tl_invitation + pending -> invited
UPDATE volunteer_enrollments
SET new_status = 'invited'
WHERE enrollment_type = 'tl_invitation' AND status = 'pending';

-- tl_invitation + approved -> enrolled
UPDATE volunteer_enrollments
SET new_status = 'enrolled'
WHERE enrollment_type = 'tl_invitation' AND status = 'approved';

-- tl_invitation + rejected -> v_rejected
UPDATE volunteer_enrollments
SET new_status = 'v_rejected'
WHERE enrollment_type = 'tl_invitation' AND status = 'rejected';

-- Handle any withdrawn/completed states (map to enrolled for now)
UPDATE volunteer_enrollments
SET new_status = 'enrolled'
WHERE new_status IS NULL AND status IN ('withdrawn', 'completed');

-- Step 3: Make new_status NOT NULL
ALTER TABLE volunteer_enrollments
ALTER COLUMN new_status SET NOT NULL;

-- Step 4: Drop old columns and constraints
DROP INDEX IF EXISTS idx_volunteer_enrollments_status;
DROP INDEX IF EXISTS idx_volunteer_enrollments_type;

ALTER TABLE volunteer_enrollments
DROP COLUMN status,
DROP COLUMN enrollment_type;

-- Step 5: Rename new_status to status
ALTER TABLE volunteer_enrollments
RENAME COLUMN new_status TO status;

-- Step 6: Add new index
CREATE INDEX idx_volunteer_enrollments_status ON volunteer_enrollments(status);

-- Step 7: Add check constraint for valid states
ALTER TABLE volunteer_enrollments
ADD CONSTRAINT chk_enrollment_status
CHECK (status IN ('requested', 'invited', 'enrolled', 'tl_rejected', 'v_rejected'));

COMMIT;

-- Verify migration
SELECT
    status,
    COUNT(*) as count
FROM volunteer_enrollments
GROUP BY status
ORDER BY status;
