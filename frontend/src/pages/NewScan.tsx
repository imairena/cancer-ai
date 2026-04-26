import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Activity, UploadCloud, ArrowLeft, AlertTriangle } from 'lucide-react'
import axios from 'axios'
import { Link } from 'react-router-dom'

export default function NewScan({ session }: { session: any }) {
  const [patientId, setPatientId] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [loading, setLoading] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)
  const navigate = useNavigate()

  const requiredChannels = ['t1c', 't1n', 't2f', 't2w']

  const getMissingChannels = (selectedFiles: File[]) => {
    return requiredChannels.filter(channel =>
      !selectedFiles.some(f => f.name.toLowerCase().includes(channel))
    )
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      addFiles(Array.from(e.target.files))
    }
  }

  const addFiles = (newFiles: File[]) => {
    setFiles(prev => {
      const merged = [...prev, ...newFiles]
      // filter out duplicates by name
      const unique = Array.from(new Map(merged.map(f => [f.name, f])).values())
      return unique
    })
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    if (e.dataTransfer.files) {
      addFiles(Array.from(e.dataTransfer.files))
    }
  }

  const handleRemove = (fileName: string) => {
    setFiles(prev => prev.filter(f => f.name !== fileName))
  }

  const missingChannels = getMissingChannels(files)
  const isReady = files.length === 4 && missingChannels.length === 0 && patientId !== ""

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isReady) return

    setLoading(true)
    setApiError(null)

    const formData = new FormData()
    files.forEach(file => {
      formData.append('scans', file)
    })
    formData.append('patient_id', patientId)
    formData.append('doctor_id', session.user.id)

    try {
      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'
      const res = await axios.post(`${backendUrl}/infer`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      })

      navigate('/report/latest', { state: { result: res.data, patientId } })
    } catch (err: any) {
      setApiError(err.response?.data?.detail || err.message)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center text-gray-500 hover:text-gray-900 transition mt-2">
              <Link to="/dashboard" className="flex items-center font-medium">
                <ArrowLeft className="h-5 w-5 mr-1" />
                Back to Dashboard
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto py-10 px-4 sm:px-6 lg:px-8">
        <div className="bg-white shadow rounded-xl p-8 border border-gray-100">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">New Scan Analysis</h2>

          <form onSubmit={handleSubmit} className="space-y-6">
            {apiError && (
              <div className="bg-red-50 text-red-700 p-4 rounded-md">
                Error: {apiError}
              </div>
            )}

            <div>
              <label htmlFor="patientId" className="block text-sm font-medium text-gray-700">
                Patient ID
              </label>
              <input
                type="text"
                id="patientId"
                required
                value={patientId}
                onChange={(e) => setPatientId(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2"
                placeholder="e.g. PAT-98765"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                MRI Scans (4 NIfTI files: _t1n.nii.gz, _t1c.nii.gz, _t2w.nii.gz, _t2f.nii.gz)
              </label>
              <div
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md hover:border-blue-400 transition bg-gray-50"
              >
                <div className="space-y-1 text-center w-full">
                  <UploadCloud className="mx-auto h-12 w-12 text-gray-400" />
                  <div className="flex text-sm text-gray-600 justify-center">
                    <label
                      htmlFor="file-upload"
                      className="relative cursor-pointer bg-white rounded-md font-medium text-blue-600 hover:text-blue-500 focus-within:outline-none px-4 py-2 border shadow-sm"
                    >
                      <span>Select files</span>
                      <input
                        id="file-upload"
                        name="file-upload"
                        type="file"
                        multiple
                        className="sr-only"
                        onChange={handleFileChange}
                      />
                    </label>
                  </div>
                  <p className="text-xs text-gray-400 mt-2">Or drag and drop them here!</p>
                  <div className="mt-4">
                    {files.length > 0 && (
                      <ul className="text-xs text-gray-500 text-left list-none inline-block mt-2 space-y-1">
                        {files.map(f => (
                          <li key={f.name} className="flex justify-between items-center bg-white px-2 py-1 border rounded">
                            <span className="truncate max-w-[200px]">{f.name}</span>
                            <button type="button" onClick={() => handleRemove(f.name)} className="text-red-500 ml-2 hover:underline">Remove</button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>

              {/* Validation Warning */}
              {files.length > 0 && files.length !== 4 && (
                <div className="mt-2 text-sm text-red-600 flex items-center">
                  <AlertTriangle className="h-4 w-4 mr-1" />
                  Please select exactly 4 files at once. You selected {files.length}.
                </div>
              )}
              {files.length === 4 && missingChannels.length > 0 && (
                <div className="mt-2 text-sm text-red-600 flex items-center">
                  <AlertTriangle className="h-4 w-4 mr-1" />
                  Missing channels: {missingChannels.map(c => `_${c}`).join(', ')}. Ensure suffixes are correct.
                </div>
              )}
            </div>

            <div className="pt-4">
              <button
                type="submit"
                disabled={loading || !isReady}
                className="w-full flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-300 disabled:cursor-not-allowed transition"
              >
                {loading ? (
                  <>
                    <Activity className="animate-spin h-5 w-5 mr-2" />
                    Generating heatmap and scanning context...
                  </>
                ) : (
                  'Analyze Scan'
                )}
              </button>
            </div>

            <p className="text-xs text-gray-500 text-center mt-4">
              Data remains strictly local and is processed on this machine.
            </p>
          </form>
        </div>
      </main>
    </div>
  )
}

