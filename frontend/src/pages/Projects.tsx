import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Project, User, ProjectMatch, CreateProjectRequest } from '../types'
import { getAllProjects, findMatchesForVolunteer, getProjectEnrollments, createProject } from '../api'
import LocationAutocomplete from '../components/LocationAutocomplete'
import { ProjectEnrollmentRequest } from '../components/ProjectEnrollmentRequest'

export default function Projects({ user }: { user?: User }) {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [matches, setMatches] = useState<ProjectMatch[]>([])
  const [finding, setFinding] = useState(false)
  const [enrollmentCounts, setEnrollmentCounts] = useState<Record<string, number>>({})
  const [memberCounts, setMemberCounts] = useState<Record<string, number>>({})
  const navigate = useNavigate()
  const [creating, setCreating] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [newLat, setNewLat] = useState<number | undefined>(undefined)
  const [newLon, setNewLon] = useState<number | undefined>(undefined)
  const [newLocationName, setNewLocationName] = useState<string | undefined>(undefined)

  // Coordinator filters/sorts
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterLocation, setFilterLocation] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'title' | 'status' | 'members' | 'location'>('status')
  const [groupBy, setGroupBy] = useState<'none' | 'status' | 'location'>('status')

  useEffect(() => {
    loadProjects()
  }, [])

  const loadProjects = async () => {
    try {
      const data = await getAllProjects()
      console.debug('[Projects] loaded', data.length, 'projects')
      setProjects(data)

      // Load enrollment counts for coordinators
      if (user?.role === 'coordinator') {
        const counts: Record<string, number> = {}
        const members: Record<string, number> = {}
        await Promise.all(
          data.map(async (project) => {
            try {
              const enrollments = await getProjectEnrollments(project.id)
              // Count 'requested' enrollments (volunteers waiting for TL approval)
              counts[project.id] = enrollments.filter(e => e.status === 'requested').length
              // Count 'enrolled' members
              members[project.id] = enrollments.filter(e => e.status === 'enrolled').length
            } catch (err) {
              counts[project.id] = 0
              members[project.id] = 0
            }
          })
        )
        setEnrollmentCounts(counts)
        setMemberCounts(members)
      }

      setLoading(false)
    } catch (err) {
      console.error('[Projects] load error', err)
      setError(err instanceof Error ? err.message : 'Failed to load projects')
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="loading">Loading projects...</div>
  }

  // Apply filtering, sorting, and grouping for coordinators
  const getFilteredAndSortedProjects = () => {
    let filtered = user?.role === 'volunteer'
      ? projects.filter(p => p.status === 'active')
      : projects

    // Apply status filter
    if (user?.role === 'coordinator' && filterStatus !== 'all') {
      filtered = filtered.filter(p => p.status === filterStatus)
    }

    // Apply location filter
    if (user?.role === 'coordinator' && filterLocation !== 'all') {
      filtered = filtered.filter(p => p.locationName === filterLocation)
    }

    // Apply sorting
    if (user?.role === 'coordinator') {
      filtered = [...filtered].sort((a, b) => {
        switch (sortBy) {
          case 'title':
            return a.name.localeCompare(b.name)
          case 'status':
            const statusOrder = { draft: 0, active: 1, retired: 2 }
            return (statusOrder[a.status as keyof typeof statusOrder] || 0) - (statusOrder[b.status as keyof typeof statusOrder] || 0)
          case 'members':
            return (memberCounts[b.id] || 0) - (memberCounts[a.id] || 0)
          case 'location':
            return (a.locationName || '').localeCompare(b.locationName || '')
          default:
            return 0
        }
      })
    }

    return filtered
  }

  // Group projects by selected criteria
  const getGroupedProjects = () => {
    const filtered = getFilteredAndSortedProjects()

    if (user?.role !== 'coordinator' || groupBy === 'none') {
      return { 'All Projects': filtered }
    }

    const grouped: Record<string, Project[]> = {}

    if (groupBy === 'status') {
      filtered.forEach(project => {
        const key = project.status || 'unknown'
        if (!grouped[key]) grouped[key] = []
        grouped[key].push(project)
      })
    } else if (groupBy === 'location') {
      filtered.forEach(project => {
        const key = project.locationName || 'No Location'
        if (!grouped[key]) grouped[key] = []
        grouped[key].push(project)
      })
    }

    return grouped
  }

  const groupedProjects = getGroupedProjects()
  const uniqueLocations = [...new Set(projects.map(p => p.locationName).filter(Boolean))]

  return (
    <div className="projects-container">
      <h2>Projects</h2>
      {error && <div className="error">{error}</div>}

      {user?.role === 'coordinator' && (
        <div className="project-card" style={{ marginBottom: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0 }}>Create New Project</h3>
            <button className="btn" onClick={() => setShowCreate(!showCreate)}>
              {showCreate ? 'Hide' : 'New Project'}
            </button>
          </div>
          {showCreate && (
            <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <input
                className="autocomplete-input"
                placeholder="Project name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
              <textarea
                className="autocomplete-input"
                placeholder="Project description"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                style={{ minHeight: '80px' }}
              />
              <LocationAutocomplete
                placeholder="Search location (optional)"
                inputStyle={{ padding: '0.5rem' }}
                onSelect={(loc) => {
                  setNewLat(loc.lat)
                  setNewLon(loc.lon)
                  setNewLocationName(loc.displayName)
                }}
              />
              {newLocationName && <div className="subtitle">Selected: {newLocationName}</div>}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button className="btn" onClick={() => { setShowCreate(false); setNewName(''); setNewDescription(''); setNewLat(undefined); setNewLon(undefined); setNewLocationName(undefined) }} disabled={creating}>Cancel</button>
                <button
                  className="btn btn-yes"
                  disabled={creating || !newName.trim()}
                  onClick={async () => {
                    setCreating(true)
                    setError('')
                    try {
                      const req: CreateProjectRequest = {
                        name: newName.trim(),
                        description: newDescription.trim(),
                        latitude: newLat,
                        longitude: newLon,
                        locationName: newLocationName,
                      }
                      const created = await createProject(req)
                      setProjects([created, ...projects])
                      setShowCreate(false)
                      setNewName('')
                      setNewDescription('')
                      setNewLat(undefined)
                      setNewLon(undefined)
                      setNewLocationName(undefined)
                    } catch (e) {
                      setError(e instanceof Error ? e.message : 'Failed to create project')
                    } finally {
                      setCreating(false)
                    }
                  }}
                >
                  {creating ? 'Creating...' : 'Create'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {user?.role === 'coordinator' && (
        <div className="project-card" style={{ marginBottom: '1rem' }}>
          <h3 style={{ marginBottom: '0.75rem' }}>Filter & Organize</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.9rem', color: '#374151' }}>
                Filter by Status
              </label>
              <select
                className="autocomplete-input"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                style={{ width: '100%', padding: '0.5rem' }}
              >
                <option value="all">All Statuses</option>
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="retired">Retired</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.9rem', color: '#374151' }}>
                Filter by Location
              </label>
              <select
                className="autocomplete-input"
                value={filterLocation}
                onChange={(e) => setFilterLocation(e.target.value)}
                style={{ width: '100%', padding: '0.5rem' }}
              >
                <option value="all">All Locations</option>
                {uniqueLocations.map(loc => (
                  <option key={loc} value={loc}>{loc}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.9rem', color: '#374151' }}>
                Sort By
              </label>
              <select
                className="autocomplete-input"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'title' | 'status' | 'members' | 'location')}
                style={{ width: '100%', padding: '0.5rem' }}
              >
                <option value="status">Status</option>
                <option value="title">Title</option>
                <option value="members">Member Count</option>
                <option value="location">Location</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.9rem', color: '#374151' }}>
                Group By
              </label>
              <select
                className="autocomplete-input"
                value={groupBy}
                onChange={(e) => setGroupBy(e.target.value as 'none' | 'status' | 'location')}
                style={{ width: '100%', padding: '0.5rem' }}
              >
                <option value="none">No Grouping</option>
                <option value="status">Status</option>
                <option value="location">Location</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {user?.role === 'volunteer' && (
        <div style={{ marginBottom: '1rem' }}>
          <button
            className="btn"
            onClick={async () => {
              if (!user) return
              setFinding(true)
              setError('')
              try {
                const res = await findMatchesForVolunteer(user.id, {
                  skillWeight: 0.7,
                  distanceWeight: 0.3,
                  maxDistanceKm: 100,
                  limit: 20,
                })
                setMatches(res)
              } catch (e) {
                setError(e instanceof Error ? e.message : 'Failed to find matches')
              } finally {
                setFinding(false)
              }
            }}
            disabled={finding}
          >
            {finding ? 'Finding matches...' : 'Find Recommended Projects'}
          </button>
        </div>
      )}

      {matches && matches.length > 0 && (
        <div className="matches-list">
          <h4>Recommended For You ({matches.length})</h4>
          {matches.map((m) => (
            <div key={m.projectId} className="project-card" onClick={() => navigate(`/projects/${m.projectId}`)}>
              <div className="project-meta" style={{ display: 'flex', justifyContent: 'space-between' }}>
                <h3>{m.projectName}</h3>
                <div className="match-score">{(m.combinedScore * 100).toFixed(0)}%</div>
              </div>
              <div className="project-meta">
                <span className="meta-item">Skill Match: {(m.skillScore * 100).toFixed(0)}%</span>
                <span className="meta-item">Distance: {m.distanceKm.toFixed(1)} km</span>
                {m.locationName && <span className="meta-item">📍 {m.locationName}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {Object.keys(groupedProjects).length === 0 || Object.values(groupedProjects).every(g => g.length === 0) ? (
        <p className="empty-state">No projects available yet.</p>
      ) : (
        Object.entries(groupedProjects).map(([groupName, groupProjects]) => (
          groupProjects.length > 0 && (
            <div key={groupName} style={{ marginBottom: '2rem' }}>
              {user?.role === 'coordinator' && groupBy !== 'none' && (
                <h3 style={{ marginBottom: '1rem', color: '#374151', textTransform: 'capitalize' }}>
                  {groupName} ({groupProjects.length})
                </h3>
              )}
              <div className="projects-grid">
                {groupProjects.map((project) => (
                  <div key={project.id} className="project-card">
                    <div onClick={() => navigate(`/projects/${project.id}`)}>
                      <h3>{project.name}</h3>
                      <p className="project-description">{project.description}</p>

                      <div className="project-meta">
                        {project.locationName && (
                          <span className="meta-item">📍 {project.locationName}</span>
                        )}
                        {project.startDate && (
                          <span className="meta-item">
                            📅 {new Date(project.startDate).toLocaleDateString()}
                          </span>
                        )}
                        {user?.role === 'coordinator' && (
                          <>
                            {memberCounts[project.id] !== undefined && (
                              <span className="meta-item">
                                👥 {memberCounts[project.id]} member{memberCounts[project.id] !== 1 ? 's' : ''}
                              </span>
                            )}
                            {enrollmentCounts[project.id] > 0 && (
                              <span className="meta-item" style={{ color: '#f59e0b' }}>
                                ⏳ {enrollmentCounts[project.id]} pending
                              </span>
                            )}
                          </>
                        )}
                        <span className={`status status-${project.status}`}>
                          {project.status}
                        </span>
                      </div>
                    </div>

                    {/* Enrollment request for volunteers */}
                    {user?.role === 'volunteer' && (
                      <div className="mt-4">
                        <ProjectEnrollmentRequest
                          project={project}
                          volunteerId={user.id}
                          onEnrollmentCreated={() => {
                            // Optionally refresh data or show success message
                          }}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )
        ))
      )}
    </div>
  )
}
