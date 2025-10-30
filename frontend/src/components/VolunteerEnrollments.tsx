import React, { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { EnrollmentWithDetails } from '../types'
import { updateEnrollmentStatus } from '../api'

interface VolunteerEnrollmentsProps {
  volunteerId: string
}

export const VolunteerEnrollments: React.FC<VolunteerEnrollmentsProps> = ({ volunteerId }) => {
  const [enrollments, setEnrollments] = useState<EnrollmentWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    loadEnrollments()
  }, [volunteerId])

  const loadEnrollments = async () => {
    try {
      setLoading(true)
      const { getVolunteerEnrollments } = await import('../api')
      const data = await getVolunteerEnrollments(volunteerId)
      setEnrollments(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load enrollments')
    } finally {
      setLoading(false)
    }
  }

  const handleEnrollmentAction = async (enrollmentId: string, action: 'accept' | 'reject' | 'withdraw', responseMessage?: string) => {
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

  const getEnrollmentTypeLabel = (status: string) => {
    return status === 'requested' ? 'Your Request' : 'TL Invitation'
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

  // Categorize enrollments
  const safeEnrollments = Array.isArray(enrollments) ? enrollments : []
  const invitations = safeEnrollments.filter(e => e.status === 'invited')
  const requests = safeEnrollments.filter(e => e.status === 'requested')
  const activeProjects = safeEnrollments.filter(e => e.status === 'enrolled')
  const pastEnrollments = safeEnrollments.filter(e => e.status === 'tl_rejected' || e.status === 'v_rejected')

  if (enrollments.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">No enrollment requests or invitations found.</p>
      </div>
    )
  }

  const renderEnrollment = (enrollment: EnrollmentWithDetails, showActions: boolean = false) => (
    <div
      key={enrollment.id}
      className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm cursor-pointer hover:shadow"
      onClick={() => navigate(`/projects/${enrollment.projectId}`)}
    >
      <div className="flex justify-between items-start mb-2">
        <div>
          <h4 className="font-medium text-gray-900">{enrollment.projectName}</h4>
          <p className="text-sm text-gray-500">
            {getEnrollmentTypeLabel(enrollment.status)} •
            Initiated by {enrollment.initiatedByName}
          </p>
        </div>
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(enrollment.status)}`}>
          {enrollment.status}
        </span>
      </div>

      {enrollment.message && (
        <div className="mb-3">
          <p className="text-sm text-gray-700">
            <span className="font-medium">Message:</span> {enrollment.message}
          </p>
        </div>
      )}

      {enrollment.responseMessage && (
        <div className="mb-3">
          <p className="text-sm text-gray-700">
            <span className="font-medium">Response:</span> {enrollment.responseMessage}
          </p>
        </div>
      )}

      <div className="flex justify-between items-center text-xs text-gray-500">
        <span>Created: {new Date(enrollment.createdAt).toLocaleDateString()}</span>
        {enrollment.approvedAt && (
          <span>Approved: {new Date(enrollment.approvedAt).toLocaleDateString()}</span>
        )}
      </div>

      {showActions && enrollment.status === 'invited' && (
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => handleEnrollmentAction(enrollment.id, 'accept')}
            className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
          >
            Accept
          </button>
          <button
            onClick={() => handleEnrollmentAction(enrollment.id, 'reject')}
            className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
          >
            Decline
          </button>
        </div>
      )}

      {!showActions && enrollment.status === 'requested' && (
        <div className="mt-3">
          <button
            onClick={(e) => { e.stopPropagation(); handleEnrollmentAction(enrollment.id, 'withdraw') }}
            className="px-3 py-1 bg-gray-700 text-white text-sm rounded hover:bg-gray-800"
          >
            Withdraw Request
          </button>
        </div>
      )}
    </div>
  )

  // Optional filtering via query param: ?filter=invitations|requests|active|rejected
  const params = new URLSearchParams(location.search)
  const filter = params.get('filter')

  const sections = [
    { key: 'invitations', items: invitations, title: 'Pending Invitations', desc: 'Team leads have invited you to join these projects. Accept or decline to respond.', badgeClass: 'bg-blue-100 text-blue-800', showActions: true },
    { key: 'requests', items: requests, title: 'Pending Requests', desc: "You've requested to join these projects. Waiting for team lead approval.", badgeClass: 'bg-yellow-100 text-yellow-800', showActions: false },
    { key: 'active', items: activeProjects, title: 'Active Projects', desc: 'Projects where you are currently enrolled and active.', badgeClass: 'bg-green-100 text-green-800', showActions: false },
    { key: 'rejected', items: pastEnrollments, title: 'Past Enrollments', desc: 'Requests or invitations that were declined or rejected.', badgeClass: 'bg-gray-100 text-gray-800', showActions: false },
  ] as const

  const visibleSections = filter ? sections.filter(s => s.key === filter) : sections

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900">My Enrollments</h3>
      {visibleSections.map(section => (
        section.items.length > 0 && (
          <div key={section.key}>
            <div className="flex items-center gap-2 mb-3">
              <h4 className="font-medium text-gray-900">{section.title}</h4>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${section.badgeClass}`}>
                {section.items.length}
              </span>
            </div>
            <p className="text-sm text-gray-600 mb-3">{section.desc}</p>
            <div className="space-y-3">
              {section.items.map(e => renderEnrollment(e, section.showActions))}
            </div>
          </div>
        )
      ))}
    </div>
  )
}
