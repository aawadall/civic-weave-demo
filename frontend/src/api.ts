import {
  User,
  LoginRequest,
  RegisterRequest,
  Skill,
  VolunteerSkill,
  Project,
  ProjectSkill,
  VolunteerMatch,
  ProjectMatch,
  UpdateSkillsRequest,
  UpdateLocationRequest,
  UpdateProjectSkillsRequest,
  UpdateProjectRequest,
  CreateProjectRequest,
  Enrollment,
  EnrollmentWithDetails,
  CreateEnrollmentRequest,
  UpdateEnrollmentRequest
} from './types'

const API_BASE = '/api'

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(error.error || 'Request failed')
  }
  return response.json()
}

// Auth APIs
export async function getExistingUsers(): Promise<User[]> {
  const response = await fetch(`${API_BASE}/users`)
  return handleResponse<User[]>(response)
}

export async function loginAsUser(request: LoginRequest): Promise<User> {
  const response = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  })
  return handleResponse<User>(response)
}

export async function registerVolunteer(request: RegisterRequest): Promise<User> {
  const response = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  })
  return handleResponse<User>(response)
}

// Skills APIs
export async function getAllSkills(): Promise<Skill[]> {
  const response = await fetch(`${API_BASE}/skills`)
  return handleResponse<Skill[]>(response)
}

export async function searchSkills(query: string, limit?: number): Promise<Skill[]> {
  const params = new URLSearchParams({ q: query })
  if (limit) params.set('limit', limit.toString())

  const response = await fetch(`${API_BASE}/skills?${params.toString()}`)
  return handleResponse<Skill[]>(response)
}

export async function createSkill(request: { name: string; description?: string; category?: string }): Promise<Skill> {
  const response = await fetch(`${API_BASE}/skills`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: request.name,
      description: request.description || '',
      category: request.category || 'General',
    }),
  })
  return handleResponse<Skill>(response)
}

export async function getVolunteerSkills(volunteerId: string): Promise<VolunteerSkill[]> {
  const response = await fetch(`${API_BASE}/volunteers/${volunteerId}/skills`)
  return handleResponse<VolunteerSkill[]>(response)
}

export async function updateVolunteerSkills(volunteerId: string, request: UpdateSkillsRequest): Promise<void> {
  const response = await fetch(`${API_BASE}/volunteers/${volunteerId}/skills`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  })
  return handleResponse<void>(response)
}

export async function updateVolunteerLocation(volunteerId: string, request: UpdateLocationRequest): Promise<void> {
  const response = await fetch(`${API_BASE}/volunteers/${volunteerId}/location`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  })
  return handleResponse<void>(response)
}

// Projects APIs
export async function getAllProjects(): Promise<Project[]> {
  const response = await fetch(`${API_BASE}/projects`)
  return handleResponse<Project[]>(response)
}

export async function getProject(projectId: string): Promise<Project> {
  const response = await fetch(`${API_BASE}/projects/${projectId}`)
  return handleResponse<Project>(response)
}

export async function getProjectSkills(projectId: string): Promise<ProjectSkill[]> {
  const response = await fetch(`${API_BASE}/projects/${projectId}/skills`)
  return handleResponse<ProjectSkill[]>(response)
}

export async function updateProjectSkills(
  projectId: string,
  request: UpdateProjectSkillsRequest
): Promise<void> {
  const response = await fetch(`${API_BASE}/projects/${projectId}/skills`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  })
  return handleResponse<void>(response)
}

export async function updateProject(projectId: string, request: UpdateProjectRequest): Promise<void> {
  const response = await fetch(`${API_BASE}/projects/${projectId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  })
  return handleResponse<void>(response)
}

export async function createProject(request: CreateProjectRequest): Promise<Project> {
  const response = await fetch(`${API_BASE}/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  })
  return handleResponse<Project>(response)
}

export async function retireProject(projectId: string): Promise<void> {
  const response = await fetch(`${API_BASE}/projects/${projectId}/status`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'retired' }),
  })
  return handleResponse<void>(response)
}

// Matching APIs
export async function findMatchesForProject(
  projectId: string,
  params?: {
    skillWeight?: number
    distanceWeight?: number
    maxDistanceKm?: number
    limit?: number
  }
): Promise<VolunteerMatch[]> {
  const queryParams = new URLSearchParams()
  // Add impersonation parameter for coordinator access
  queryParams.set('impersonate', 'coordinator')
  if (params?.skillWeight) queryParams.set('skillWeight', params.skillWeight.toString())
  if (params?.distanceWeight) queryParams.set('distanceWeight', params.distanceWeight.toString())
  if (params?.maxDistanceKm) queryParams.set('maxDistanceKm', params.maxDistanceKm.toString())
  if (params?.limit) queryParams.set('limit', params.limit.toString())

  const url = `${API_BASE}/projects/${projectId}/matches?${queryParams.toString()}`
  const response = await fetch(url)
  return handleResponse<VolunteerMatch[]>(response)
}

export async function findMatchesForVolunteer(
  volunteerId: string,
  params?: {
    skillWeight?: number
    distanceWeight?: number
    maxDistanceKm?: number
    limit?: number
  }
): Promise<ProjectMatch[]> {
  const queryParams = new URLSearchParams()
  // Impersonation parameter for volunteer access
  queryParams.set('impersonate', 'volunteer')
  if (params?.skillWeight) queryParams.set('skillWeight', params.skillWeight.toString())
  if (params?.distanceWeight) queryParams.set('distanceWeight', params.distanceWeight.toString())
  if (params?.maxDistanceKm) queryParams.set('maxDistanceKm', params.maxDistanceKm.toString())
  if (params?.limit) queryParams.set('limit', params.limit.toString())

  const url = `${API_BASE}/volunteers/${volunteerId}/matches?${queryParams.toString()}`
  const response = await fetch(url)
  return handleResponse<ProjectMatch[]>(response)
}

// Enrollment APIs
export async function createEnrollment(
  userId: string,
  request: CreateEnrollmentRequest
): Promise<Enrollment> {
  const response = await fetch(`${API_BASE}/enrollments?userId=${userId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  })
  return handleResponse<Enrollment>(response)
}

export async function getProjectEnrollments(projectId: string): Promise<EnrollmentWithDetails[]> {
  const response = await fetch(`${API_BASE}/projects/${projectId}/enrollments`)
  return handleResponse<EnrollmentWithDetails[]>(response)
}

export async function getVolunteerEnrollments(volunteerId: string): Promise<EnrollmentWithDetails[]> {
  const response = await fetch(`${API_BASE}/volunteers/${volunteerId}/enrollments`)
  return handleResponse<EnrollmentWithDetails[]>(response)
}

export async function updateEnrollmentStatus(
  enrollmentId: string,
  request: UpdateEnrollmentRequest
): Promise<void> {
  const response = await fetch(`${API_BASE}/enrollments/${enrollmentId}/status`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  })
  return handleResponse<void>(response)
}

export async function checkEnrollmentStatus(
  volunteerId: string,
  projectId: string
): Promise<{ enrolled: boolean }> {
  const response = await fetch(`${API_BASE}/volunteers/${volunteerId}/projects/${projectId}/enrollment-status`)
  return handleResponse<{ enrolled: boolean }>(response)
}

export async function getPendingEnrollments(): Promise<EnrollmentWithDetails[]> {
  const response = await fetch(`${API_BASE}/enrollments/pending`)
  return handleResponse<EnrollmentWithDetails[]>(response)
}
