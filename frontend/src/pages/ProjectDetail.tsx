import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Project, ProjectSkill, VolunteerMatch, Skill as SkillType, User, EnrollmentWithDetails, UpdateProjectSkillsRequest, VolunteerSkill } from '../types'
import { getProject, getProjectSkills, findMatchesForProject, getAllSkills, createEnrollment, getProjectEnrollments, updateProjectSkills, updateProject, retireProject, updateVolunteerSkills, getVolunteerSkills } from '../api'
import LocationAutocomplete from '../components/LocationAutocomplete'
import SkillAutocomplete from '../components/SkillAutocomplete'
import { ProjectEnrollments } from '../components/ProjectEnrollments'

export default function ProjectDetail({ user }: { user?: User }) {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [project, setProject] = useState<Project | null>(null)
  const [projectSkills, setProjectSkills] = useState<ProjectSkill[]>([])
  const [matches, setMatches] = useState<VolunteerMatch[]>([])
  const [enrollments, setEnrollments] = useState<EnrollmentWithDetails[]>([])
  const [allSkills, setAllSkills] = useState<SkillType[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMatches, setLoadingMatches] = useState(false)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<'members' | 'matches' | 'requests' | 'tasks'>('members')
  const [editingSkills, setEditingSkills] = useState(false)
  const [editedSkills, setEditedSkills] = useState<ProjectSkill[]>([])
  const [savingSkills, setSavingSkills] = useState(false)
  const [editingDetails, setEditingDetails] = useState(false)
  const retire = async () => {
    if (!project) return
    try {
      await retireProject(project.id)
      await loadProject()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to retire project')
    }
  }

  const publish = async () => {
    if (!project) return
    try {
      await fetch(`/api/projects/${project.id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'active' }),
      })
      await loadProject()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to publish project')
    }
  }
  const [savingDetails, setSavingDetails] = useState(false)
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editLatitude, setEditLatitude] = useState<number | undefined>(undefined)
  const [editLongitude, setEditLongitude] = useState<number | undefined>(undefined)
  const [editLocationName, setEditLocationName] = useState<string | undefined>(undefined)

  // Member skill editing modal
  const [showSkillModal, setShowSkillModal] = useState(false)
  const [selectedMember, setSelectedMember] = useState<EnrollmentWithDetails | null>(null)
  const [editedMemberSkills, setEditedMemberSkills] = useState<VolunteerSkill[]>([])
  const [loadingMemberSkills, setLoadingMemberSkills] = useState(false)
  const [savingMemberSkills, setSavingMemberSkills] = useState(false)

  useEffect(() => {
    if (id) {
      loadProject()
    }
  }, [id])

  const loadProject = async () => {
    if (!id) return

    try {
      const [projectData, skills, allSkillsData, enrolls] = await Promise.all([
        getProject(id),
        getProjectSkills(id),
        getAllSkills(),
        getProjectEnrollments(id),
      ])

      console.debug('[ProjectDetail] loaded project', projectData.id, projectData.status, 'skills', skills?.length || 0, 'enrollments', enrolls?.length || 0)
      setProject(projectData)
      setEditName(projectData.name)
      setEditDescription(projectData.description)
      setEditLatitude(projectData.latitude)
      setEditLongitude(projectData.longitude)
      setEditLocationName(projectData.locationName)
      setProjectSkills(skills || [])
      setAllSkills(allSkillsData || [])
      setEnrollments(enrolls || [])
      setLoading(false)

      if (user?.role === 'volunteer' && (projectData.status === 'draft' || projectData.status === 'retired')) {
        const hasSkills = Array.isArray(skills) && skills.length > 0
        if (hasSkills) {
          navigate('/projects')
          return
        }
      }
    } catch (err) {
      console.error('[ProjectDetail] load error', err)
      setError(err instanceof Error ? err.message : 'Failed to load project')
      setLoading(false)
    }
  }

  const startEditingDetails = () => {
    if (!project) return
    setEditName(project.name)
    setEditDescription(project.description)
    setEditLatitude(project.latitude)
    setEditLongitude(project.longitude)
    setEditLocationName(project.locationName)
    setEditingDetails(true)
  }

  const cancelEditingDetails = () => {
    setEditingDetails(false)
  }

  const saveDetails = async () => {
    if (!project) return
    setSavingDetails(true)
    try {
      await updateProject(project.id, {
        name: editName.trim(),
        description: editDescription.trim(),
        latitude: editLatitude,
        longitude: editLongitude,
        locationName: editLocationName,
      })
      await loadProject()
      setEditingDetails(false)
      setError('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update project')
    } finally {
      setSavingDetails(false)
    }
  }

  const findMatches = async () => {
    if (!id) return

    setLoadingMatches(true)
    try {
      const matchData = await findMatchesForProject(id, {
        skillWeight: 0.7,
        distanceWeight: 0.3,
        maxDistanceKm: 100,
        limit: 20,
      })
      setMatches(matchData || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to find matches')
      setMatches([]) // Ensure matches is always an array
    } finally {
      setLoadingMatches(false)
    }
  }

  const inviteVolunteer = async (volunteerId: string) => {
    if (!user || user.role !== 'coordinator' || !project) return
    try {
      setError('')
      await createEnrollment(user.id, {
        projectId: project.id,
        action: 'invite',
        volunteerId,
      })
      // Refresh enrollments - this will automatically remove the volunteer from visibleMatches
      await loadProject()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to send invitation')
    }
  }

  const startEditingSkills = () => {
    setEditedSkills([...projectSkills])
    setEditingSkills(true)
  }

  const cancelEditingSkills = () => {
    setEditingSkills(false)
    setEditedSkills([])
  }

  // addSkill was removed in favor of autocomplete add flow

  const removeSkill = (skillId: string) => {
    setEditedSkills(editedSkills.filter(s => s.skillId !== skillId))
  }

  const updateSkillProperty = (
    skillId: string,
    property: 'skillId' | 'required' | 'weight',
    value: string | boolean | number
  ) => {
    setEditedSkills(
      editedSkills.map(s => {
        if (s.skillId === skillId) {
          if (property === 'skillId') {
            // When changing skill, update skillName too
            const newSkill = allSkills.find(skill => skill.id === value)
            return {
              ...s,
              skillId: value as string,
              skillName: newSkill?.name,
            }
          }
          return { ...s, [property]: value }
        }
        return s
      })
    )
  }

  const saveSkills = async () => {
    if (!project) return
    setSavingSkills(true)
    try {
      const request: UpdateProjectSkillsRequest = {
        skills: editedSkills.map(s => ({
          skillId: s.skillId,
          required: s.required,
          weight: s.weight,
        })),
      }
      await updateProjectSkills(project.id, request)
      await loadProject() // Refresh to get updated skills
      setEditingSkills(false)
      setError('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update skills')
    } finally {
      setSavingSkills(false)
    }
  }

  const openMemberSkillModal = async (member: EnrollmentWithDetails) => {
    setSelectedMember(member)
    setShowSkillModal(true)
    setLoadingMemberSkills(true)
    try {
      const skills = await getVolunteerSkills(member.volunteerId)
      setEditedMemberSkills(skills || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load member skills')
      setEditedMemberSkills([])
    } finally {
      setLoadingMemberSkills(false)
    }
  }

  const closeMemberSkillModal = () => {
    setShowSkillModal(false)
    setSelectedMember(null)
    setEditedMemberSkills([])
  }

  const updateMemberSkillScore = (skillId: string, score: number) => {
    setEditedMemberSkills(
      editedMemberSkills.map(s =>
        s.skillId === skillId ? { ...s, score: Math.max(0, Math.min(1, score)) } : s
      )
    )
  }

  const saveMemberSkills = async () => {
    if (!selectedMember) return
    setSavingMemberSkills(true)
    try {
      await updateVolunteerSkills(selectedMember.volunteerId, {
        skills: editedMemberSkills.map(s => ({
          skillId: s.skillId,
          claimed: s.claimed,
          score: s.score,
        })),
      })
      closeMemberSkillModal()
      setError('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update member skills')
    } finally {
      setSavingMemberSkills(false)
    }
  }

  if (loading) {
    return <div className="loading">Loading project...</div>
  }

  if (!project) {
    return <div className="error">Project not found</div>
  }

  const getSkillName = (skillId: string) => {
    return allSkills.find((s) => s.id === skillId)?.name || skillId
  }

  // Exclude volunteers who have ANY existing enrollment for this project
  // (database has unique constraint on volunteer_id + project_id)
  const excludedVolunteerIds = new Set(
    (enrollments || []).map(e => e.volunteerId)
  )
  const visibleMatches = matches.filter(m => !excludedVolunteerIds.has(m.volunteerId))

  return (
    <div className="project-detail-container">
      <div className="project-header">
        <h2>{project.name}</h2>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <span className={`status status-${project.status}`}>{project.status}</span>
          {user?.role === 'coordinator' && project.status === 'draft' && (
            <button className="btn btn-yes" onClick={publish} style={{ padding: '0.25rem 0.5rem' }}>Publish</button>
          )}
          {user?.role === 'coordinator' && project.status === 'active' && (
            <button className="btn btn-no" onClick={retire} style={{ padding: '0.25rem 0.5rem' }}>Retire</button>
          )}
        </div>
      </div>

      <div className="project-content">
        <div className="project-info">
          <h3>Details</h3>
          {!editingDetails ? (
            <>
              <div className="info-item"><strong>Name:</strong> {project.name}</div>
              <p style={{ marginTop: '0.5rem' }}>{project.description}</p>
              {project.locationName && (
                <div className="info-item" style={{ marginTop: '0.5rem' }}>
                  <strong>Location:</strong> {project.locationName}
                </div>
              )}
            </>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.25rem', color: '#374151' }}>Name</label>
                <input
                  className="autocomplete-input"
                  style={{ padding: '0.5rem', fontSize: '0.95rem' }}
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Project name"
                />
              </div>
              <textarea
                className="autocomplete-input"
                style={{ minHeight: '100px', padding: '0.5rem', fontSize: '0.95rem' }}
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Project description"
              />
              <div>
                <label style={{ display: 'block', marginBottom: '0.25rem', color: '#374151' }}>Location</label>
                <LocationAutocomplete
                  placeholder="Search city, neighborhood, or address"
                  inputStyle={{ padding: '0.5rem', fontSize: '0.95rem' }}
                  onSelect={(loc) => {
                    setEditLatitude(loc.lat)
                    setEditLongitude(loc.lon)
                    setEditLocationName(loc.displayName)
                  }}
                />
                {editLocationName && (
                  <div className="subtitle" style={{ marginTop: '0.5rem' }}>
                    Selected: {editLocationName}
                  </div>
                )}
              </div>
            </div>
          )}

          {project.locationName && (
            <div className="info-item">
              <strong>Location:</strong> {project.locationName}
            </div>
          )}

          {project.startDate && (
            <div className="info-item">
              <strong>Start Date:</strong>{' '}
              {new Date(project.startDate).toLocaleDateString()}
            </div>
          )}

          {project.maxVolunteers && (
            <div className="info-item">
              <strong>Max Volunteers:</strong> {project.maxVolunteers}
            </div>
          )}
          {/* Details Footer */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.75rem' }}>
            {!editingDetails && user?.role === 'coordinator' && (
              <button className="btn" onClick={startEditingDetails}>Edit Details</button>
            )}
            {editingDetails && (
              <>
                <button className="btn btn-yes" onClick={saveDetails} disabled={savingDetails}>
                  {savingDetails ? 'Saving...' : 'Save'}
                </button>
                <button className="btn" onClick={cancelEditingDetails} disabled={savingDetails}>Cancel</button>
              </>
            )}
          </div>
        </div>

        <div className="project-skills-section">
          <h3>Project Skills</h3>

          {!editingSkills ? (
            projectSkills.length > 0 ? (
              <div className="skills-tags">
                {projectSkills.map((ps) => (
                  <span key={ps.skillId} className={`skill-tag ${ps.required ? 'required' : ''}`}>
                    {ps.skillName || getSkillName(ps.skillId)}
                    {ps.required && ' *'}
                    <span className="weight"> ({(ps.weight * 100).toFixed(0)}%)</span>
                  </span>
                ))}
              </div>
            ) : (
              <p className="subtitle">No skills defined yet.</p>
            )
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {/* Add Skill via autocomplete */}
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <SkillAutocomplete
                  placeholder="Add skill..."
                  onSelect={(s) => {
                    if (!project) return
                    // Avoid duplicates
                    if (editedSkills.some(es => es.skillId === s.id)) return
                    setEditedSkills([
                      ...editedSkills,
                      {
                        projectId: project.id,
                        skillId: s.id,
                        skillName: s.name,
                        required: false,
                        weight: 0.5,
                      },
                    ])
                  }}
                />
              </div>

              {editedSkills.map((skill, index) => (
                <div key={index} style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'flex-start', padding: '0.5rem', border: '1px solid var(--border-color)', borderRadius: '4px' }}>
                  <div style={{ flex: 1, minWidth: 320 }}>
                    <SkillAutocomplete
                      placeholder={skill.skillName || 'Search skill...'}
                      onSelect={(s) => {
                        // Update both id and name to reflect selection or newly created skill
                        setEditedSkills(editedSkills.map(es => es === skill ? { ...es, skillId: s.id, skillName: s.name } : es))
                      }}
                    />
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <input
                      type="checkbox"
                      checked={skill.required}
                      onChange={(e) => updateSkillProperty(skill.skillId, 'required', e.target.checked)}
                    />
                    Required
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    Weight:
                    <input
                      type="number"
                      min="0"
                      max="1"
                      step="0.1"
                      value={skill.weight}
                      onChange={(e) => updateSkillProperty(skill.skillId, 'weight', parseFloat(e.target.value) || 0)}
                      style={{ width: '64px', padding: '0.3rem', fontSize: '0.95rem' }}
                    />
                  </label>
                  <button
                    className="btn btn-no"
                    onClick={() => removeSkill(skill.skillId)}
                    style={{ padding: '0.2rem 0.4rem', fontSize: '0.85rem' }}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Skills Footer */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.75rem' }}>
            {!editingSkills && user?.role === 'coordinator' && (
              <button className="btn" onClick={startEditingSkills}>Edit Skills</button>
            )}
            {editingSkills && (
              <>
                <button className="btn btn-yes" onClick={saveSkills} disabled={savingSkills}>
                  {savingSkills ? 'Saving...' : 'Save'}
                </button>
                <button className="btn" onClick={cancelEditingSkills} disabled={savingSkills}>Cancel</button>
              </>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="login-tabs" style={{ marginTop: '1rem' }}>
          <button
            className={`tab-button ${activeTab === 'members' ? 'active' : ''}`}
            onClick={() => setActiveTab('members')}
          >
            Active Members
          </button>
          <button
            className={`tab-button ${activeTab === 'matches' ? 'active' : ''}`}
            onClick={() => setActiveTab('matches')}
          >
            Top Matches
          </button>
          <button
            className={`tab-button ${activeTab === 'requests' ? 'active' : ''}`}
            onClick={() => setActiveTab('requests')}
          >
            Requests
          </button>
          <button
            className={`tab-button ${activeTab === 'tasks' ? 'active' : ''}`}
            onClick={() => setActiveTab('tasks')}
          >
            Tasks
          </button>
        </div>

        {/* Tab content */}
        {activeTab === 'members' && (
          <div className="project-info" style={{ marginTop: '1rem' }}>
            <h3>Active Members</h3>
            {enrollments.filter(e => e.status === 'enrolled').length === 0 ? (
              <p className="subtitle">No active members yet.</p>
            ) : (
              <div className="projects-grid">
                {enrollments.filter(e => e.status === 'enrolled').map(e => (
                  <div
                    key={e.id}
                    className="project-card"
                    onClick={() => user?.role === 'coordinator' && openMemberSkillModal(e)}
                    style={{ cursor: user?.role === 'coordinator' ? 'pointer' : 'default' }}
                  >
                    <h3 style={{ marginBottom: '0.25rem' }}>{e.volunteerName}</h3>
                    <p className="project-description">{e.volunteerEmail}</p>
                    <div className="project-meta">
                      <div className="meta-item">
                        <span className="status status-active">enrolled</span>
                      </div>
                      <div className="meta-item">
                        <span className="location">Joined {new Date(e.approvedAt || e.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                    {user?.role === 'coordinator' && (
                      <p className="subtitle" style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>
                        Click to edit skills
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'matches' && (
          <div className="matching-section" style={{ marginTop: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3>Top Matches</h3>
                <p className="subtitle">Excludes already enrolled/requested volunteers</p>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn" onClick={findMatches} disabled={loadingMatches}>
                  {loadingMatches ? 'Refreshing…' : 'Refresh'}
                </button>
              </div>
            </div>
            {error && <div className="error">{error}</div>}
            {visibleMatches && visibleMatches.length > 0 ? (
              <div className="matches-list">
                {visibleMatches.map((match) => (
                  <div key={match.volunteerId} className="match-card">
                    <div className="match-header">
                      <div>
                        <h5>{match.volunteerName}</h5>
                        <p className="email">{match.email}</p>
                      </div>
                      <div className="match-score">
                        {(match.combinedScore * 100).toFixed(0)}%
                      </div>
                    </div>

                    <div className="match-details">
                      <div className="score-breakdown">
                        <div className="score-item">
                          <span className="label">Skill Match:</span>
                          <span className="value">{(match.skillScore * 100).toFixed(0)}%</span>
                        </div>
                        <div className="score-item">
                          <span className="label">Distance:</span>
                          <span className="value">{match.distanceKm.toFixed(1)} km</span>
                        </div>
                      </div>

                      {match.locationName && (
                        <div className="location">📍 {match.locationName}</div>
                      )}

                      {Array.isArray(match.matchedSkills) && (match.matchedSkills || []).length > 0 && (
                        <div className="matched-skills">
                          <strong>Matched Skills:</strong>
                          {(Array.isArray(match.matchedSkills) ? match.matchedSkills : []).map((skillId) => (
                            <span key={skillId} className="matched-skill" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                              {getSkillName(skillId)}
                              {user?.role === 'coordinator' && (
                                <input
                                  type="number"
                                  min={0}
                                  max={1}
                                  step={0.1}
                                  defaultValue={0.5}
                                  style={{ width: 56, padding: '0.15rem 0.25rem', fontSize: '0.85rem' }}
                                  onBlur={async (e) => {
                                    const value = parseFloat(e.target.value)
                                    if (isNaN(value)) return
                                    try {
                                      await updateVolunteerSkills(match.volunteerId, {
                                        skills: [{ skillId, claimed: true, score: Math.max(0, Math.min(1, value)) }],
                                      })
                                    } catch (err) {
                                      // eslint-disable-next-line no-console
                                      console.error('Failed to update volunteer skill', err)
                                    }
                                  }}
                                  title="Adjust volunteer skill score"
                                />
                              )}
                            </span>
                          ))}
                        </div>
                      )}
                      {user?.role === 'coordinator' && (
                        <div style={{ marginTop: '0.5rem' }}>
                          <button
                            className="btn btn-yes"
                            onClick={() => inviteVolunteer(match.volunteerId)}
                          >
                            Invite
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="subtitle">No matches yet. Click Refresh to fetch top matches.</p>
            )}
          </div>
        )}

        {activeTab === 'requests' && (
          <div className="project-info" style={{ marginTop: '1rem' }}>
            <h3>Requests</h3>
            <ProjectEnrollments projectId={project.id} projectName={project.name} />
          </div>
        )}

        {activeTab === 'tasks' && (
          <div className="project-info" style={{ marginTop: '1rem' }}>
            <h3>Tasks</h3>
            <p className="subtitle">No tasks defined yet.</p>
          </div>
        )}

      </div>

      {/* Member Skill Editing Modal */}
      {showSkillModal && selectedMember && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={closeMemberSkillModal}
        >
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '8px',
              padding: '2rem',
              maxWidth: '600px',
              width: '90%',
              maxHeight: '80vh',
              overflowY: 'auto',
              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ margin: 0 }}>Edit Skills: {selectedMember.volunteerName}</h2>
              <button
                onClick={closeMemberSkillModal}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '1.5rem',
                  cursor: 'pointer',
                  color: '#6b7280',
                }}
              >
                ×
              </button>
            </div>

            {loadingMemberSkills ? (
              <div className="loading">Loading skills...</div>
            ) : (
              <>
                {editedMemberSkills.length === 0 ? (
                  <p className="subtitle">This member has no skills defined yet.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {editedMemberSkills.map((skill) => (
                      <div
                        key={skill.skillId}
                        style={{
                          padding: '1rem',
                          border: '1px solid var(--border-color)',
                          borderRadius: '4px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.5rem',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <h4 style={{ margin: 0 }}>
                            {skill.skillName || getSkillName(skill.skillId)}
                          </h4>
                          <span
                            className={skill.claimed ? 'status status-active' : 'status status-draft'}
                            style={{ fontSize: '0.85rem' }}
                          >
                            {skill.claimed ? 'Claimed' : 'Unclaimed'}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                          <label style={{ fontWeight: 500, color: '#374151' }}>
                            Skill Score:
                          </label>
                          <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.05"
                            value={skill.score}
                            onChange={(e) => updateMemberSkillScore(skill.skillId, parseFloat(e.target.value))}
                            style={{ flex: 1 }}
                          />
                          <input
                            type="number"
                            min="0"
                            max="1"
                            step="0.05"
                            value={skill.score.toFixed(2)}
                            onChange={(e) => updateMemberSkillScore(skill.skillId, parseFloat(e.target.value) || 0)}
                            style={{
                              width: '80px',
                              padding: '0.4rem',
                              fontSize: '0.95rem',
                              border: '1px solid var(--border-color)',
                              borderRadius: '4px',
                            }}
                          />
                        </div>
                        <div style={{ fontSize: '0.9rem', color: '#6b7280' }}>
                          Score: {(skill.score * 100).toFixed(0)}%
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.5rem' }}>
                  <button className="btn" onClick={closeMemberSkillModal} disabled={savingMemberSkills}>
                    Cancel
                  </button>
                  <button
                    className="btn btn-yes"
                    onClick={saveMemberSkills}
                    disabled={savingMemberSkills || editedMemberSkills.length === 0}
                  >
                    {savingMemberSkills ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
