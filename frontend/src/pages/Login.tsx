import { useState, useEffect } from 'react'
import { User } from '../types'
import { getExistingUsers, loginAsUser, registerVolunteer } from '../api'

interface LoginProps {
  onLogin: (user: User) => void
}

type TabType = 'existing' | 'register'

export default function Login({ onLogin }: LoginProps) {
  const [activeTab, setActiveTab] = useState<TabType>('existing')
  const [existingUsers, setExistingUsers] = useState<User[]>([])
  const [selectedUserId, setSelectedUserId] = useState('')
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (activeTab === 'existing') {
      loadExistingUsers()
    }
  }, [activeTab])

  const loadExistingUsers = async () => {
    try {
      const users = await getExistingUsers()
      setExistingUsers(users)
      if (users.length > 0) {
        setSelectedUserId(users[0].id)
      }
    } catch (err) {
      setError('Failed to load users. Make sure the backend is running.')
    }
  }

  const handleExistingUserLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedUserId) return

    setLoading(true)
    setError('')

    try {
      const selectedUser = existingUsers.find(u => u.id === selectedUserId)
      if (selectedUser) {
        const user = await loginAsUser({ email: selectedUser.email })
        onLogin(user)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const user = await registerVolunteer({ email, name })
      onLogin(user)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <h1>Civic Weave</h1>
          <p>Volunteering CRM</p>
        </div>

        <div className="login-tabs">
          <button
            className={`tab-button ${activeTab === 'existing' ? 'active' : ''}`}
            onClick={() => setActiveTab('existing')}
          >
            Select Role
          </button>
          <button
            className={`tab-button ${activeTab === 'register' ? 'active' : ''}`}
            onClick={() => setActiveTab('register')}
          >
            Register as Volunteer
          </button>
        </div>

        {error && <div className="error">{error}</div>}

        {activeTab === 'existing' ? (
          <form onSubmit={handleExistingUserLogin}>
            <div className="form-group">
              <label htmlFor="user-select">Select a role to impersonate:</label>
              <select
                id="user-select"
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                required
              >
                {existingUsers.length === 0 ? (
                  <option value="">No users available</option>
                ) : (
                  existingUsers.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name} ({user.role})
                    </option>
                  ))
                )}
              </select>
            </div>
            <button
              type="submit"
              className="btn"
              disabled={loading || existingUsers.length === 0}
            >
              {loading ? 'Logging in...' : 'Login as Selected User'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleRegister}>
            <div className="form-group">
              <label htmlFor="name">Name:</label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your name"
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="email">Email:</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                required
              />
            </div>
            <button type="submit" className="btn" disabled={loading}>
              {loading ? 'Registering...' : 'Register as Volunteer'}
            </button>
            <p style={{ marginTop: '1rem', fontSize: '0.875rem', color: 'rgba(255, 255, 255, 0.6)', textAlign: 'center' }}>
              You can complete your profile later
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
