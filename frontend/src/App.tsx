import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './supabase'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import NewScan from './pages/NewScan'
import Report from './pages/Report'
import Admin from './pages/Admin'
import { Activity } from 'lucide-react'

function App() {
  const [session, setSession] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Activity className="animate-spin h-8 w-8 text-blue-600" />
      </div>
    )
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={!session ? <Login /> : <Navigate to="/dashboard" />} />
        <Route path="/dashboard" element={session ? <Dashboard session={session} /> : <Navigate to="/" />} />
        <Route path="/new-scan" element={session ? <NewScan session={session} /> : <Navigate to="/" />} />
        <Route path="/report/:id" element={session ? <Report /> : <Navigate to="/" />} />
        <Route path="/admin" element={session ? <Admin session={session} /> : <Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
