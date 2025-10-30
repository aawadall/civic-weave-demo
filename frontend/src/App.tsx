import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Skills from './pages/Skills'
import Projects from './pages/Projects'
import ProjectDetail from './pages/ProjectDetail'
import MyEnrollments from './pages/MyEnrollments'
import { User } from './types'

function App() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check if user is already logged in
    const storedUser = localStorage.getItem('user')
    if (storedUser) {
      setUser(JSON.parse(storedUser))
    }
    setLoading(false)
  }, [])

  const handleLogin = (userData: User) => {
    setUser(userData)
    localStorage.setItem('user', JSON.stringify(userData))
  }

  const handleLogout = () => {
    setUser(null)
    localStorage.removeItem('user')
  }

  if (loading) {
    return <div className="loading">Loading...</div>
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={user ? <Navigate to="/" /> : <Login onLogin={handleLogin} />}
        />
        <Route
          path="/"
          element={
            user ? (
              <Dashboard user={user} onLogout={handleLogout} />
            ) : (
              <Navigate to="/login" />
            )
          }
        />
        <Route
          path="/skills"
          element={
            user ? (
              <Dashboard user={user} onLogout={handleLogout}>
                <Skills user={user} />
              </Dashboard>
            ) : (
              <Navigate to="/login" />
            )
          }
        />
        <Route
          path="/projects"
          element={
            user ? (
              <Dashboard user={user} onLogout={handleLogout}>
                <Projects user={user} />
              </Dashboard>
            ) : (
              <Navigate to="/login" />
            )
          }
        />
        <Route
          path="/projects/:id"
          element={
            user ? (
              <Dashboard user={user} onLogout={handleLogout}>
                <ProjectDetail user={user} />
              </Dashboard>
            ) : (
              <Navigate to="/login" />
            )
          }
        />
        <Route
          path="/my-enrollments"
          element={
            user ? (
              <Dashboard user={user} onLogout={handleLogout}>
                <MyEnrollments user={user} />
              </Dashboard>
            ) : (
              <Navigate to="/login" />
            )
          }
        />
      </Routes>
    </BrowserRouter>
  )
}

export default App
