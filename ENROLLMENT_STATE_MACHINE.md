# Enrollment State Machine Implementation

## States Defined

| State | Code | Description | Initiated By |
|-------|------|-------------|--------------|
| 0 | `undefined` | No enrollment record exists | N/A |
| 1 | `requested` | Volunteer requested to join | Volunteer |
| 2 | `invited` | TL invited volunteer | Team Lead |
| 3 | `enrolled` | Both parties accepted | Either |
| 4 | `tl_rejected` | TL rejected volunteer's request | Team Lead |
| 5 | `v_rejected` | Volunteer rejected TL's invitation | Volunteer |

## State Transitions

```
undefined (0)
  ├─→ requested (1)  [Volunteer: action="request"]
  └─→ invited (2)    [TL: action="invite"]

requested (1)
  ├─→ enrolled (3)     [TL: action="accept"]
  └─→ tl_rejected (4)  [TL: action="reject"]

invited (2)
  ├─→ enrolled (3)    [Volunteer: action="accept"]
  └─→ v_rejected (5)  [Volunteer: action="reject"]
```

## Backend Changes (COMPLETED ✅)

### Database Migration
- **File**: `database/migrations/003_enrollment_state_machine.sql`
- Removed: `enrollment_type`, old `status` column
- Added: New `status` column with states: `requested`, `invited`, `enrolled`, `tl_rejected`, `v_rejected`
- Migrated existing data

### Models Updated
- **File**: `backend/internal/models/enrollment.go`
- Removed `EnrollmentType` field from `Enrollment`
- Changed `CreateEnrollmentRequest.enrollmentType` → `CreateEnrollmentRequest.action` ("request" | "invite")
- Changed `UpdateEnrollmentRequest.status` → `UpdateEnrollmentRequest.action` ("accept" | "reject")

### Service Updated
- **File**: `backend/internal/enrollment/service.go`
- `CreateEnrollment()`: Takes `action` parameter, sets initial status based on action
- `UpdateEnrollmentStatus()`: Takes `action` parameter, validates state transitions
- `IsVolunteerEnrolled()`: Checks for `requested`, `invited`, or `enrolled` states

### API Handlers Updated
- **File**: `backend/internal/api/enrollment_handlers.go`
- Validates `action` parameter instead of `enrollmentType`
- Better error messages for invalid state transitions

## Frontend Changes Needed

### 1. Update Types (`frontend/src/types.ts`)
```typescript
// Remove enrollmentType field
export interface Enrollment {
  id: string
  volunteerId: string
  projectId: string
  status: 'requested' | 'invited' | 'enrolled' | 'tl_rejected' | 'v_rejected'  // UPDATED
  initiatedBy: string
  message?: string
  responseMessage?: string
  createdAt: string
  updatedAt: string
  approvedAt?: string
  completedAt?: string
}

// Update request models
export interface CreateEnrollmentRequest {
  projectId: string
  action: 'request' | 'invite'  // CHANGED from enrollmentType
  volunteerId?: string  // required for action='invite'
  message?: string
}

export interface UpdateEnrollmentRequest {
  action: 'accept' | 'reject'  // CHANGED from status
  responseMessage?: string
}
```

### 2. Update API Calls (`frontend/src/api.ts`)
```typescript
// Update createEnrollment to use 'action'
await createEnrollment(user.id, {
  projectId: project.id,
  action: 'invite',  // or 'request'
  volunteerId: volunteerId,  // for invites
})

// Update updateEnrollmentStatus to use 'action'
await updateEnrollmentStatus(enrollmentId, {
  action: 'accept',  // or 'reject'
})
```

### 3. Update UI Components

#### ProjectDetail.tsx
- Change `enrollmentType: 'tl_invitation'` → `action: 'invite'`

#### ProjectEnrollmentRequest.tsx
- Change `enrollmentType: 'volunteer_request'` → `action: 'request'`

#### ProjectEnrollments.tsx
- Remove `enrollmentType` checks
- Update UI based on `status` field:
  - `requested`: Show "Volunteer Request" + Accept/Reject buttons (for TL)
  - `invited`: Show "TL Invitation" + status
  - `enrolled`: Show "Enrolled"
  - `tl_rejected`: Show "Rejected by TL"
  - `v_rejected`: Show "Declined by Volunteer"
- Update button actions:
  - `handleEnrollmentAction(id, 'accept')` instead of `handleEnrollmentAction(id, 'approved')`
  - `handleEnrollmentAction(id, 'reject')` instead of `handleEnrollmentAction(id, 'rejected')`

#### Projects.tsx
- Update enrollment count filter to check for `status === 'requested'` or `status === 'invited'`

## Testing Checklist

- [ ] Volunteer can request to join project (`action='request'` → `status='requested'`)
- [ ] TL can invite volunteer (`action='invite'` → `status='invited'`)
- [ ] TL can accept volunteer request (`requested` + `action='accept'` → `enrolled`)
- [ ] TL can reject volunteer request (`requested` + `action='reject'` → `tl_rejected`)
- [ ] Volunteer can accept TL invitation (`invited` + `action='accept'` → `enrolled`)
- [ ] Volunteer can reject TL invitation (`invited` + `action='reject'` → `v_rejected`)
- [ ] UI correctly shows state labels
- [ ] UI shows correct actions based on user role and enrollment state
