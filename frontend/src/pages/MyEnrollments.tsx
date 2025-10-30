import { User } from '../types'
import { VolunteerEnrollments } from '../components/VolunteerEnrollments'

export default function MyEnrollments({ user }: { user: User }) {
  if (!user || user.role !== 'volunteer') {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">This page is only available for volunteers.</p>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">My Enrollments</h2>
      <VolunteerEnrollments volunteerId={user.id} />
    </div>
  )
}
