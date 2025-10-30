export interface User {
  id: string
  email: string
  name: string
  role: string
  profileComplete: boolean
  createdAt: string
  latitude?: number
  longitude?: number
  locationName?: string
}

export interface LoginRequest {
  email: string
}

export interface RegisterRequest {
  email: string
  name: string
}

export interface ApiResponse<T> {
  data: T
  error?: string
}

export interface Skill {
  id: string
  name: string
  description: string
  category: string
  createdAt: string
}

export interface VolunteerSkill {
  volunteerId: string
  skillId: string
  skillName?: string
  claimed: boolean
  score: number // [0, 1]
  createdAt: string
  updatedAt: string
}

export interface Project {
  id: string
  name: string
  description: string
  coordinatorId?: string
  latitude?: number
  longitude?: number
  locationName?: string
  startDate?: string
  endDate?: string
  status: string
  maxVolunteers?: number
  createdAt: string
  updatedAt: string
}

export interface ProjectSkill {
  projectId: string
  skillId: string
  skillName?: string
  required: boolean
  weight: number // [0, 1]
}

export interface VolunteerMatch {
  volunteerId: string
  volunteerName: string
  email: string
  skillScore: number
  distanceKm: number
  combinedScore: number
  matchedSkills: string[]
  latitude?: number
  longitude?: number
  locationName?: string
}

export interface ProjectMatch {
  projectId: string
  projectName: string
  skillScore: number
  distanceKm: number
  combinedScore: number
  matchedSkills: string[]
  latitude?: number
  longitude?: number
  locationName?: string
}

export interface UpdateSkillsRequest {
  skills: {
    skillId: string
    claimed: boolean
    score: number
  }[]
}

export interface UpdateLocationRequest {
  latitude: number
  longitude: number
  locationName: string
}

export interface CreateSkillRequest {
  name: string
  description: string
  category: string
}

export interface UpdateProjectSkillsRequest {
  skills: {
    skillId: string
    required: boolean
    weight: number
  }[]
}

export interface Enrollment {
  id: string
  volunteerId: string
  projectId: string
  status: 'requested' | 'invited' | 'enrolled' | 'tl_rejected' | 'v_rejected'
  initiatedBy: string
  message?: string
  responseMessage?: string
  createdAt: string
  updatedAt: string
  approvedAt?: string
  completedAt?: string
}

export interface EnrollmentWithDetails extends Enrollment {
  volunteerName: string
  volunteerEmail: string
  projectName: string
  initiatedByName: string
}

export interface CreateEnrollmentRequest {
  projectId: string
  action: 'request' | 'invite'
  volunteerId?: string // required for action='invite'
  message?: string
}

export interface UpdateEnrollmentRequest {
  action: 'accept' | 'reject' | 'withdraw'
  responseMessage?: string
}

export interface UpdateProjectRequest {
  name: string
  description: string
  latitude?: number
  longitude?: number
  locationName?: string
}

export interface CreateProjectRequest {
  name: string
  description: string
  coordinatorId?: string
  latitude?: number
  longitude?: number
  locationName?: string
  startDate?: string
  endDate?: string
  maxVolunteers?: number
}
