import { useState, useEffect } from 'react'
import { User, Skill } from '../types'
import { getVolunteerSkills, updateVolunteerSkills, getAllSkills } from '../api'
import SkillAutocomplete from '../components/SkillAutocomplete'

interface SkillsProps {
  user: User
}

interface SkillWithScore extends Skill {
  score: number
}

export default function Skills({ user }: SkillsProps) {
  const [selectedSkills, setSelectedSkills] = useState<SkillWithScore[]>([])
  const [allSkills, setAllSkills] = useState<Skill[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    loadSkills()
  }, [user.id])

  const loadSkills = async () => {
    try {
      const [volunteerSkills, skills] = await Promise.all([
        getVolunteerSkills(user.id),
        getAllSkills(),
      ])

      setAllSkills(skills)

      // Map volunteer skills to full skill objects with scores
      const skillsWithScores: SkillWithScore[] = volunteerSkills
        .filter((vs) => vs.claimed)
        .map((vs) => {
          const skill = skills.find((s) => s.id === vs.skillId)
          return skill ? { ...skill, score: vs.score } : null
        })
        .filter((s): s is SkillWithScore => s !== null)

      setSelectedSkills(skillsWithScores)
      setLoading(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load skills')
      setLoading(false)
    }
  }

  const handleAddSkill = (skill: Skill) => {
    // Check if already added
    if (selectedSkills.some((s) => s.id === skill.id)) {
      return
    }

    // Add with default score of 0.5
    setSelectedSkills([...selectedSkills, { ...skill, score: 0.5 }])

    // Update allSkills if it's a new skill
    if (!allSkills.some((s) => s.id === skill.id)) {
      setAllSkills([...allSkills, skill])
    }
  }

  const handleRemoveSkill = (skillId: string) => {
    setSelectedSkills(selectedSkills.filter((s) => s.id !== skillId))
  }

  const handleSave = async () => {
    setSaving(true)
    setError('')
    setSuccess('')

    try {
      const skills = selectedSkills.map((skill) => ({
        skillId: skill.id,
        claimed: true,
        score: skill.score,
      }))

      await updateVolunteerSkills(user.id, { skills })
      setSuccess('Skills updated successfully!')
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save skills')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="loading">Loading skills...</div>
  }

  return (
    <div className="skills-container">
      <h2>My Skills</h2>
      <p className="subtitle">
        Add skills you have by searching below or creating new ones.
      </p>

      {error && <div className="error">{error}</div>}
      {success && <div className="success">{success}</div>}

      <div className="skills-input-section">
        <label htmlFor="skill-search">Add Skills</label>
        <SkillAutocomplete
          onSelect={handleAddSkill}
          placeholder="Search or type to create new skill..."
        />
      </div>

      <div className="selected-skills">
        <h3>Your Skills ({selectedSkills.length})</h3>

        {selectedSkills.length === 0 ? (
          <p className="empty-state">No skills added yet. Search and add skills above.</p>
        ) : (
          <div className="skill-chips-list">
            {selectedSkills.map((skill) => (
              <div key={skill.id} className="skill-chip-card">
                <div className="skill-chip-header">
                  <div className="skill-chip-info">
                    <span className="skill-chip-name">{skill.name}</span>
                    {skill.category && (
                      <span className="skill-chip-category">{skill.category}</span>
                    )}
                    <span className="skill-chip-score" title="Estimated proficiency score">
                      {(skill.score * 100).toFixed(0)}%
                    </span>
                  </div>
                  <button
                    className="skill-chip-remove"
                    onClick={() => handleRemoveSkill(skill.id)}
                    title="Remove skill"
                  >
                    ✕
                  </button>
                </div>

                {skill.description && (
                  <div className="skill-chip-description">{skill.description}</div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <button className="btn btn-save" onClick={handleSave} disabled={saving}>
        {saving ? 'Saving...' : 'Save Skills'}
      </button>
    </div>
  )
}
