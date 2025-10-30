import { useState, useEffect } from 'react'
import { User, VolunteerSkill } from '../types'
import { getVolunteerSkills, updateVolunteerLocation } from '../api'
import LocationAutocomplete from './LocationAutocomplete'

interface VolunteerProfileProps {
  user: User
}

export const VolunteerProfile: React.FC<VolunteerProfileProps> = ({ user }) => {
  const [skills, setSkills] = useState<VolunteerSkill[]>([])
  const [loading, setLoading] = useState(true)
  const [savingLocation, setSavingLocation] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [currentLocationName, setCurrentLocationName] = useState<string | undefined>(user.locationName || undefined)

  useEffect(() => {
    loadSkills()
  }, [user.id])

  const loadSkills = async () => {
    try {
      const data = await getVolunteerSkills(user.id)
      setSkills(data.filter(s => s.claimed)) // Only show claimed skills
      setLoading(false)
    } catch (err) {
      console.error('Failed to load skills:', err)
      setLoading(false)
    }
  }

  // Calculate average skill score
  const averageScore = skills.length > 0
    ? skills.reduce((sum, skill) => sum + skill.score, 0) / skills.length
    : 0

  const getScoreColor = (score: number) => {
    if (score >= 0.8) return 'text-green-600'
    if (score >= 0.6) return 'text-yellow-600'
    if (score >= 0.4) return 'text-orange-600'
    return 'text-red-600'
  }

  const getScoreBgColor = (score: number) => {
    if (score >= 0.8) return 'bg-green-100'
    if (score >= 0.6) return 'bg-yellow-100'
    if (score >= 0.4) return 'bg-orange-100'
    return 'bg-red-100'
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-xl font-semibold text-gray-900">{user.name}</h3>
          <p className="text-sm text-gray-500 mt-1">
            {currentLocationName || 'Location not set'}
          </p>
        </div>
        <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
          Volunteer
        </span>
      </div>

      <div className="mb-5">
        <h4 className="text-sm font-medium text-gray-700 mb-2">Set Your Location</h4>
        <div style={{ display: 'block' }}>
          <LocationAutocomplete
            placeholder={savingLocation ? 'Saving...' : 'Search city, neighborhood, or address'}
            disabled={savingLocation}
            onSelect={async (loc) => {
              if (savingLocation) return
              setError('')
              setSuccess('')
              setSavingLocation(true)
              try {
                await updateVolunteerLocation(user.id, {
                  latitude: loc.lat,
                  longitude: loc.lon,
                  locationName: loc.displayName,
                })
                setCurrentLocationName(loc.displayName)
                setSuccess('Location updated')
              } catch (e) {
                setError(e instanceof Error ? e.message : 'Failed to update location')
              } finally {
                setSavingLocation(false)
              }
            }}
          />
        </div>
        {error && <div className="error" style={{ marginTop: '0.5rem' }}>{error}</div>}
        {success && <div className="success" style={{ marginTop: '0.5rem' }}>{success}</div>}
      </div>

      {loading ? (
        <div className="flex justify-center py-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-600 mb-1">Skills Claimed</p>
              <p className="text-2xl font-bold text-gray-900">{skills.length}</p>
            </div>
            <div className={`${getScoreBgColor(averageScore)} rounded-lg p-4`}>
              <p className="text-sm text-gray-600 mb-1">Average Skill Score</p>
              <p className={`text-2xl font-bold ${getScoreColor(averageScore)}`}>
                {(averageScore * 100).toFixed(0)}%
              </p>
            </div>
          </div>

          {skills.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">Top Skills</h4>
              <div className="flex flex-wrap gap-2">
                {skills
                  .sort((a, b) => b.score - a.score)
                  .slice(0, 5)
                  .map((skill) => (
                    <span
                      key={skill.skillId}
                      className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm"
                    >
                      {skill.skillName} ({(skill.score * 100).toFixed(0)}%)
                    </span>
                  ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
