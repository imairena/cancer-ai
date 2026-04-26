import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Activity, Plus, FileText, CheckCircle, AlertTriangle, ChevronDown } from 'lucide-react'
import { supabase } from '../supabase'

export default function Dashboard({ session }: { session: any }) {
  const [cases, setCases] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showAll, setShowAll] = useState(false)

  useEffect(() => {
    fetchCases()
  }, [])

  const fetchCases = async () => {
    console.log("=== DIAGNOSTIC DEBUG TRACE ===");
    console.log("Currently Authenticated Doctor ID:", session?.user?.id);
    
    const { data: rawData, error } = await supabase
      .from('diagnostic-results')
      .select('*')
      .eq('doctor_id', session.user.id)
      .order('created_at', { ascending: false })
      
    console.log("Raw SQL Query Results Return Array:", rawData);
    console.log("Raw SQL Query Error Map:", error);
    
    if (rawData) {
      const processedCases = await Promise.all(rawData.map(async (cs) => {
        let finalReportUrl = cs.report_url;
        
        if (cs.report_url && !cs.report_url.startsWith('http')) {
          const { data, error } = await supabase
            .storage
            .from('diagnostic-results')
            .createSignedUrl(cs.report_url, 3600)

          if (error) {
            console.error('Signed URL error:', error)
            return cs
          }

          const signedUrl = data.signedUrl
          finalReportUrl = signedUrl
        }
        
        return {
          ...cs,
          report_url: finalReportUrl
        }
      }))
      setCases(processedCases);
    }
    setLoading(false)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
  }

  const getProbabilityColor = (prob: number) => {
    const percent = prob * 100;
    if (percent <= 30) return 'text-green-600 bg-green-50 border-green-200';
    if (percent <= 60) return 'text-amber-600 bg-amber-50 border-amber-200';
    return 'text-red-600 bg-red-50 border-red-200';
  }

  const displayedCases = showAll ? cases : cases.slice(0, 10);

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Activity className="h-8 w-8 text-blue-600" />
              <span className="ml-2 text-xl font-bold text-gray-900">CancerAI Dashboard</span>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600 border px-3 py-1 rounded bg-gray-100">{session.user.email}</span>
              <button
                onClick={handleLogout}
                className="text-gray-500 hover:text-gray-700 text-sm font-medium"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-semibold text-gray-900">Recent Scans</h1>
            <Link
              to="/new-scan"
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition"
            >
              <Plus className="h-4 w-4 mr-2" />
              New Scan Analysis
            </Link>
          </div>

          {loading ? (
            <div className="flex justify-center p-12">
              <Activity className="animate-spin h-8 w-8 text-blue-600" />
            </div>
          ) : cases.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-12 text-center text-gray-500 border border-gray-100">
              No previous scans found. Click "New Scan Analysis" to start.
            </div>
          ) : (
            <div className="space-y-4">
              {displayedCases.map((cs) => (
                <div key={cs.id} className="bg-white shadow-sm overflow-hidden sm:rounded-lg border border-gray-200 hover:shadow transition-shadow">
                  <div className="px-4 py-5 sm:px-6">
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col">
                        <p className="text-lg font-bold text-gray-900">
                          Patient ID: {cs.patient_id}
                        </p>
                        <p className="text-sm text-gray-500 mt-1 flex items-center">
                          <CheckCircle className="w-4 h-4 mr-1 text-gray-400" />
                          {new Date(cs.created_at).toLocaleDateString()} at {new Date(cs.created_at).toLocaleTimeString()}
                        </p>
                      </div>
                      
                      <div className="flex items-center space-x-6">
                        <div className="flex flex-col items-end">
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-bold border ${getProbabilityColor(cs.malignancy_probability)}`}>
                            Malignancy: {(cs.malignancy_probability * 100).toFixed(1)}%
                          </span>
                          { (cs.confidence_high - cs.confidence_low) > 0.3 && (
                             <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 mt-2">
                               <AlertTriangle className="w-3 h-3 mr-1 text-amber-500" /> Wide bounds
                             </span>
                          )}
                        </div>
                        
                        <a 
                          href={cs.report_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none transition group"
                        >
                          <FileText className="h-5 w-5 mr-2 text-blue-500 group-hover:text-blue-700" />
                          View Report
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              
              {cases.length > 10 && !showAll && (
                <div className="pt-4 flex justify-center">
                  <button
                    onClick={() => setShowAll(true)}
                    className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition"
                  >
                    <ChevronDown className="h-4 w-4 mr-2" />
                    View All {cases.length} Scans
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
