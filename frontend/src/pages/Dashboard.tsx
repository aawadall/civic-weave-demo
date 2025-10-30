import { ReactNode, useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { User, EnrollmentWithDetails } from '../types'
import { getVolunteerEnrollments } from '../api'
import { VolunteerProfile } from '../components/VolunteerProfile'

interface DashboardProps {
  user: User
  onLogout: () => void
  children?: ReactNode
}

export default function Dashboard({ user, onLogout, children }: DashboardProps) {
  const location = useLocation()
  const [enrollments, setEnrollments] = useState<EnrollmentWithDetails[]>([])
  const [loadingEnrollments, setLoadingEnrollments] = useState(true)
  const [triggering, setTriggering] = useState(false)

  useEffect(() => {
    if (user.role === 'volunteer') {
      loadEnrollments()
    }
  }, [user.id, user.role])

  const loadEnrollments = async () => {
    try {
      const data = await getVolunteerEnrollments(user.id)
      setEnrollments(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Failed to load enrollments:', err)
    } finally {
      setLoadingEnrollments(false)
    }
  }

  const isActive = (path: string) => {
    return location.pathname === path || location.pathname.startsWith(path + '/')
  }

  const safeEnrollments = Array.isArray(enrollments) ? enrollments : []
  const enrollmentStats = {
    invited: safeEnrollments.filter(e => e.status === 'invited').length,
    requested: safeEnrollments.filter(e => e.status === 'requested').length,
    enrolled: safeEnrollments.filter(e => e.status === 'enrolled').length,
    rejected: safeEnrollments.filter(e => e.status === 'tl_rejected' || e.status === 'v_rejected').length,
  }

  const triggerMatching = async () => {
    if (triggering) return
    setTriggering(true)
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 4000)
      const triggerUrl = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_MATCH_TRIGGER_URL) || 'http://localhost:5001/run'
      const res = await fetch(triggerUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
      })
      clearTimeout(timeout)
      if (!res.ok) throw new Error('Failed to trigger')
      // eslint-disable-next-line no-alert
      alert('Batch matching started')
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(e)
      // eslint-disable-next-line no-alert
      alert('Matching service is not reachable. Start scripts/app.py (Flask) that triggers scripts/batch_matching.py, or set VITE_MATCH_TRIGGER_URL')
    } finally {
      setTriggering(false)
    }
  }

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <h1>Civic Weave</h1>
        <nav className="dashboard-nav">
          <Link to="/" className={isActive('/') && location.pathname === '/' ? 'active' : ''}>
            Dashboard
          </Link>
          {user.role === 'volunteer' && (
            <Link to="/skills" className={isActive('/skills') ? 'active' : ''}>
              My Skills
            </Link>
          )}
          <Link to="/projects" className={isActive('/projects') ? 'active' : ''}>
            Projects
          </Link>
          {typeof user.role === 'string' && user.role.toLowerCase() === 'coordinator' && (
            <button onClick={triggerMatching} disabled={triggering} style={{ padding: '0.4rem 0.75rem', borderRadius: 4, opacity: triggering ? 0.6 : 1 }} className="btn-yes">
              {triggering ? 'Triggering…' : 'Trigger Matching'}
            </button>
          )}
          {user.role === 'volunteer' && (
            <Link to="/my-enrollments" className={isActive('/my-enrollments') ? 'active' : ''}>
              My Enrollments
            </Link>
          )}
        </nav>
        <div className="user-info">
          <div className="user-badge">
            <span className="name">{user.name}</span>
            <span className="role">{user.role}</span>
          </div>
          <button className="btn-logout" onClick={onLogout}>
            Logout
          </button>
        </div>
      </header>

      <main className="dashboard-content">
        {children || (
          <div className="welcome-message">
            <h2>Welcome, {user.name}!</h2>
            <p>This is your volunteering CRM dashboard.</p>

            {!user.profileComplete && (
              <div className="profile-incomplete">
                <p>Your profile is incomplete. You can complete it anytime to access more features.</p>
              </div>
            )}

            {user.role === 'volunteer' && (
              <div style={{ marginTop: '2rem' }}>
                <h3>Your Profile</h3>
                <VolunteerProfile user={user} />

                {!loadingEnrollments && (
                  <div style={{ marginTop: '2rem' }}>
                    <h3>Enrollment Overview</h3>
                    <div className="projects-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
                      <Link to="/my-enrollments?filter=invitations" className="project-card" style={{ backgroundColor: '#EFF6FF', borderColor: '#BFDBFE', textDecoration: 'none' }}>
                        <h4 style={{ fontSize: '1.5rem', marginBottom: '0.5rem', color: '#1E40AF' }}>{enrollmentStats.invited}</h4>
                        <p style={{ fontSize: '0.875rem', color: '#3B82F6' }}>Pending Invitations</p>
                        <p className="subtitle" style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>Waiting for your response</p>
                      </Link>
                      <Link to="/my-enrollments?filter=requests" className="project-card" style={{ backgroundColor: '#FEF3C7', borderColor: '#FCD34D', textDecoration: 'none' }}>
                        <h4 style={{ fontSize: '1.5rem', marginBottom: '0.5rem', color: '#92400E' }}>{enrollmentStats.requested}</h4>
                        <p style={{ fontSize: '0.875rem', color: '#D97706' }}>Pending Requests</p>
                        <p className="subtitle" style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>Waiting for TL approval</p>
                      </Link>
                      <Link to="/my-enrollments?filter=active" className="project-card" style={{ backgroundColor: '#D1FAE5', borderColor: '#6EE7B7', textDecoration: 'none' }}>
                        <h4 style={{ fontSize: '1.5rem', marginBottom: '0.5rem', color: '#065F46' }}>{enrollmentStats.enrolled}</h4>
                        <p style={{ fontSize: '0.875rem', color: '#059669' }}>Active Projects</p>
                        <p className="subtitle" style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>Currently enrolled</p>
                      </Link>
                      <Link to="/my-enrollments?filter=rejected" className="project-card" style={{ backgroundColor: '#FEE2E2', borderColor: '#FCA5A5', textDecoration: 'none' }}>
                        <h4 style={{ fontSize: '1.5rem', marginBottom: '0.5rem', color: '#7F1D1D' }}>{enrollmentStats.rejected}</h4>
                        <p style={{ fontSize: '0.875rem', color: '#DC2626' }}>Past Rejections</p>
                        <p className="subtitle" style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>Declined/rejected</p>
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="quick-actions">
              <h3>Quick Actions</h3>
              <div className="actions-grid">
                {user.role === 'volunteer' && (
                  <Link to="/skills" className="action-card">
                    <h4>Manage Skills</h4>
                    <p>Update your skills and proficiency levels</p>
                  </Link>
                )}
                <Link to="/projects" className="action-card">
                  <h4>Browse Projects</h4>
                  <p>Find volunteer opportunities that match your skills</p>
                </Link>
                {user.role === 'volunteer' && (
                  <Link to="/my-enrollments" className="action-card">
                    <h4>My Enrollments</h4>
                    <p>View your enrollment requests and invitations</p>
                  </Link>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
