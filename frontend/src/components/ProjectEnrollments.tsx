import React, { useState, useEffect } from 'react'
import { EnrollmentWithDetails } from '../types'
import { updateEnrollmentStatus, findMatchesForProject } from '../api'

interface ProjectEnrollmentsProps {
  projectId: string
  projectName: string
}

export const ProjectEnrollments: React.FC<ProjectEnrollmentsProps> = ({ projectId, projectName }) => {
  const [enrollments, setEnrollments] = useState<EnrollmentWithDetails[]>([])
  const [matches, setMatches] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showMatches, setShowMatches] = useState(false)

  useEffect(() => {
    loadEnrollments()
    loadMatches()
  }, [projectId])

  const loadEnrollments = async () => {
    try {
      setLoading(true)
      const { getProjectEnrollments } = await import('../api')
      const data = await getProjectEnrollments(projectId)
      setEnrollments(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load enrollments')
    } finally {
      setLoading(false)
    }
  }

  const loadMatches = async () => {
    try {
      const data = await findMatchesForProject(projectId, { limit: 20 })
      setMatches(data)
    } catch (err) {
      console.error('Failed to load matches:', err)
    }
  }

  const handleEnrollmentAction = async (enrollmentId: string, action: 'accept' | 'reject', responseMessage?: string) => {
    try {
      await updateEnrollmentStatus(enrollmentId, { action, responseMessage })
      await loadEnrollments() // Reload to get updated data
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update enrollment')
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'requested': return 'bg-yellow-100 text-yellow-800'
      case 'invited': return 'bg-blue-100 text-blue-800'
      case 'enrolled': return 'bg-green-100 text-green-800'
      case 'tl_rejected': return 'bg-red-100 text-red-800'
      case 'v_rejected': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getMatchScore = (volunteerId: string) => {
    const match = matches.find(m => m.volunteerId === volunteerId)
    return match ? {
      combinedScore: match.combinedScore,
      skillScore: match.skillScore,
      distanceKm: match.distanceKm,
      matchedSkills: match.matchedSkills
    } : null
  }

  const getScoreColor = (score: number) => {
    if (score >= 0.8) return 'text-green-600'
    if (score >= 0.6) return 'text-yellow-600'
    return 'text-red-600'
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-4">
        <p className="text-red-800">{error}</p>
        <button 
          onClick={loadEnrollments}
          className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    )
  }

  // Show 'requested' enrollments (volunteers requesting to join, waiting for TL approval)
  const pendingEnrollments = enrollments.filter(e => e.status === 'requested')
  const otherEnrollments = enrollments.filter(e => e.status !== 'requested')

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gray-900">
          Enrollments for {projectName}
        </h3>
        <button
          onClick={() => setShowMatches(!showMatches)}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          {showMatches ? 'Hide' : 'Show'} Recommended Volunteers
        </button>
      </div>

      {/* Show recommended volunteers */}
      {showMatches && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-medium text-blue-900 mb-3">Recommended Volunteers (Not Yet Enrolled)</h4>
          <div className="space-y-2">
            {matches.slice(0, 5).map((match) => (
              <div key={match.volunteerId} className="bg-white border border-blue-200 rounded p-3">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium text-gray-900">{match.volunteerName}</p>
                    <p className="text-sm text-gray-600">{match.email}</p>
                    <p className="text-sm text-gray-500">{match.locationName}</p>
                  </div>
                  <div className="text-right">
                    <p className={`font-medium ${getScoreColor(match.combinedScore)}`}>
                      {(match.combinedScore * 100).toFixed(1)}% match
                    </p>
                    <p className="text-xs text-gray-500">
                      Skills: {(match.skillScore * 100).toFixed(1)}% • 
                      Distance: {match.distanceKm.toFixed(1)}km
                    </p>
                  </div>
                </div>
                {match.matchedSkills.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs text-gray-600">
                      Matched skills: {match.matchedSkills.join(', ')}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pending enrollments */}
      {pendingEnrollments.length > 0 && (
        <div>
          <h4 className="font-medium text-gray-900 mb-3">Pending Requests ({pendingEnrollments.length})</h4>
          <div className="space-y-3">
            {pendingEnrollments.map((enrollment) => {
              const matchData = getMatchScore(enrollment.volunteerId)
              return (
                <div key={enrollment.id} className="enrollment-card shadow-sm">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h5 className="font-medium text-gray-900">{enrollment.volunteerName}</h5>
                      <p className="text-sm text-gray-500">{enrollment.volunteerEmail}</p>
                      <p className="text-sm text-gray-500">Volunteer Request</p>
                    </div>
                    <div className="text-right">
                      {matchData ? (
                        <div>
                          <p className={`font-medium ${getScoreColor(matchData.combinedScore)}`}>
                            {(matchData.combinedScore * 100).toFixed(1)}% match
                          </p>
                          <p className="text-xs text-gray-500">
                            Skills: {(matchData.skillScore * 100).toFixed(1)}% • 
                            Distance: {matchData.distanceKm.toFixed(1)}km
                          </p>
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500">No match data</p>
                      )}
                    </div>
                  </div>

                  {enrollment.message && (
                    <div className="mb-3">
                      <p className="text-sm text-gray-700">
                        <span className="font-medium">Message:</span> {enrollment.message}
                      </p>
                    </div>
                  )}

                  {matchData && matchData.matchedSkills.length > 0 && (
                    <div className="mb-3">
                      <p className="text-xs text-gray-600">
                        <span className="font-medium">Matched skills:</span> {matchData.matchedSkills.join(', ')}
                      </p>
                    </div>
                  )}

                  <div className="text-xs text-gray-600 mb-3">
                    Requested: {new Date(enrollment.createdAt).toLocaleDateString()}
                  </div>
                  <div className="enrollment-actions">
                    <button
                      onClick={() => handleEnrollmentAction(enrollment.id, 'accept')}
                      className="px-3 py-2 text-sm rounded btn-yes"
                    >
                      Accept
                    </button>
                    <button
                      onClick={() => handleEnrollmentAction(enrollment.id, 'reject')}
                      className="px-3 py-2 text-sm rounded btn-no"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Other enrollments */}
      {otherEnrollments.length > 0 && (
        <div>
          <h4 className="font-medium text-gray-900 mb-3">Other Enrollments ({otherEnrollments.length})</h4>
          <div className="space-y-2">
            {otherEnrollments.map((enrollment) => (
              <div key={enrollment.id} className="bg-white border border-gray-200 rounded p-3">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-medium text-gray-900">{enrollment.volunteerName}</p>
                    <p className="text-sm text-gray-500">{enrollment.volunteerEmail}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(enrollment.status)}`}>
                      {enrollment.status}
                    </span>
                    <span className="text-xs text-gray-500">
                      {new Date(enrollment.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                {enrollment.responseMessage && (
                  <p className="text-sm text-gray-600 mt-2">
                    <span className="font-medium">Response:</span> {enrollment.responseMessage}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {enrollments.length === 0 && (
        <div className="text-center py-8">
          <p className="text-gray-500">No enrollments found for this project.</p>
        </div>
      )}
    </div>
  )
}
