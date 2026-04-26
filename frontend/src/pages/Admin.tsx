import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Shield, ArrowLeft, Users } from 'lucide-react'
import { supabase } from '../supabase'

export default function Admin({ session }: { session: any }) {
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // In a real application, fetching user lists requires Service Role Key from the backend
    // Since Supabase JS client doesn't allow user listing by default context
    // Here we'd call a backend endpoint. For this mockup, we'll display dummy data 
    // or rely on a custom view / backend call.
    setLoading(false)
  }, [])

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <Link to="/dashboard" className="flex items-center text-gray-500 hover:text-gray-900 transition font-medium">
              <ArrowLeft className="h-5 w-5 mr-1" />
              Back to Dashboard
            </Link>
          </div>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto py-10 px-4 sm:px-6 lg:px-8">
        <div className="bg-white shadow rounded-2xl overflow-hidden border border-gray-100 p-8">
           <div className="flex items-center space-x-3 mb-8 pb-4 border-b">
              <Shield className="h-8 w-8 text-blue-600" />
              <h2 className="text-2xl font-bold text-gray-900">Admin Dashboard</h2>
           </div>
           
           <div className="text-center py-12 text-gray-500">
             <Users className="mx-auto h-12 w-12 text-gray-300 mb-4" />
             <h3 className="text-lg font-medium text-gray-900">User Management</h3>
             <p className="mt-2 text-sm max-w-md mx-auto">
               This panel is intended for managing doctors and radiologists (role assignment). The logic for fetching the user pool should be integrated via a secure backend endpoint using the Supabase Service Role Key.
             </p>
           </div>
        </div>
      </main>
    </div>
  )
}
