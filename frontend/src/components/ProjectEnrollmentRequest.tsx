import React, { useState } from 'react'
import { Project } from '../types'
import { createEnrollment, checkEnrollmentStatus } from '../api'

interface ProjectEnrollmentRequestProps {
  project: Project
  volunteerId: string
  onEnrollmentCreated?: () => void
}

export const ProjectEnrollmentRequest: React.FC<ProjectEnrollmentRequestProps> = ({ 
  project, 
  volunteerId, 
  onEnrollmentCreated 
}) => {
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isEnrolled, setIsEnrolled] = useState<boolean | null>(null)
  const [checkingEnrollment, setCheckingEnrollment] = useState(true)

  React.useEffect(() => {
    checkEnrollment()
  }, [volunteerId, project.id])

  const checkEnrollment = async () => {
    try {
      setCheckingEnrollment(true)
      const result = await checkEnrollmentStatus(volunteerId, project.id)
      setIsEnrolled(result.enrolled)
    } catch (err) {
      console.error('Failed to check enrollment status:', err)
    } finally {
      setCheckingEnrollment(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!message.trim()) return

    try {
      setLoading(true)
      setError(null)
      
      await createEnrollment(volunteerId, {
        projectId: project.id,
        action: 'request',
        message: message.trim()
      })
      
      setMessage('')
      setIsEnrolled(true)
      onEnrollmentCreated?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create enrollment request')
    } finally {
      setLoading(false)
    }
  }

  if (checkingEnrollment) {
    return (
      <div className="flex justify-center items-center p-4">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (isEnrolled) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <p className="text-sm font-medium text-green-800">
              You have already requested to join this project
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <h4 className="font-medium text-gray-900 mb-3">Request to Join Project</h4>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-1">
            Why are you interested in this project?
          </label>
          <textarea
            id="message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Tell us about your interest and relevant experience..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            rows={3}
            required
          />
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-3">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={loading || !message.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Sending...' : 'Send Request'}
          </button>
        </div>
      </form>
    </div>
  )
}
