import { useState, useEffect } from 'react'
import { useLocation, Link } from 'react-router-dom'
import { ArrowLeft, AlertTriangle, Download, Eye } from 'lucide-react'
import { supabase } from '../supabase'

export default function Report() {
  const location = useLocation()
  const { result, patientId } = location.state || {}
  const [heatmapSrc, setHeatmapSrc] = useState<string>('')
  const [reportSrc, setReportSrc] = useState<string>('')
  const [pageError, setPageError] = useState<string | null>(null)

  useEffect(() => {
    console.log("=== REPORT COMPONENT MOUNTED: result object ===", result);
    
    const fetchUrls = async () => {
      try {
        // Heatmap Logic
        if (result?.heatmap_url && !result.heatmap_url.startsWith('http')) {
          const { data, error } = await supabase
            .storage
            .from('diagnostic-results')
            .createSignedUrl(result.heatmap_url, 3600)

          if (error) {
            console.error('Signed URL error:', error)
          } else if (data?.signedUrl) {
            setHeatmapSrc(data.signedUrl)
          }
        } else if (result?.heatmap_url) {
          setHeatmapSrc(result.heatmap_url)
        }
        
        // PDF Logic
        if (result?.report_url && !result.report_url.startsWith('http')) {
          const { data, error } = await supabase
            .storage
            .from('diagnostic-results')
            .createSignedUrl(result.report_url, 3600)

          if (error) {
            console.error('Signed URL error:', error)
          } else if (data?.signedUrl) {
            setReportSrc(data.signedUrl)
          }
        } else if (result?.report_url) {
          setReportSrc(result.report_url)
        }
      } catch (err: any) {
        console.error("Critical block failure fetching mapped Tokens:", err);
        setPageError(err.message || String(err));
      }
    }
    
    if (result) {
        fetchUrls()
    }
  }, [result])

  const handleDownloadPdf = () => {
    if (!reportSrc) return
    const a = document.createElement('a')
    a.href = reportSrc
    a.download = 'diagnostic-report.pdf'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  const handleViewHeatmap = async () => {
    if (!result?.heatmap_url && !heatmapSrc) return

    if (result?.heatmap_url?.startsWith('http')) {
      window.open(result.heatmap_url, '_blank')
      return
    }

    if (result?.heatmap_url) {
      const { data, error } = await supabase
        .storage
        .from('diagnostic-results')
        .createSignedUrl(result.heatmap_url, 3600)

      if (error) {
        console.error('Signed URL error:', error)
        return
      }

      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank')
        return
      }
    }

    if (heatmapSrc) {
      window.open(heatmapSrc, '_blank')
    }
  }

  if (pageError) {
    return (
      <div className="min-h-screen text-red-500 p-8 flex flex-col justify-center items-center">
        <h1 className="text-2xl font-bold">Critical Application Render Error</h1>
        <p className="mt-4">{pageError}</p>
        <Link to="/dashboard" className="mt-8 text-blue-500 underline">Return Home</Link>
      </div>
    )
  }

  if (!result) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-xl text-gray-500">No result found.</p>
        <Link to="/dashboard" className="ml-4 text-blue-500 underline">Go Home</Link>
      </div>
    )
  }

  let confidenceWidth = 0;
  let isLowConfidence = false;
  let probStr = "0.0";
  try {
      confidenceWidth = (result.confidence_high || 0) - (result.confidence_low || 0);
      isLowConfidence = confidenceWidth > 0.3;
      probStr = ((result.malignancy_probability || 0) * 100).toFixed(1);
  } catch (err) {
      console.error("Math rendering error:", err)
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <Link to="/dashboard" className="flex items-center text-gray-500 hover:text-gray-900 transition font-medium">
              <ArrowLeft className="h-5 w-5 mr-1" />
              Dashboard
            </Link>
          </div>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto py-10 px-4 sm:px-6 lg:px-8">
        <div className="bg-white shadow-xl rounded-2xl overflow-hidden border border-gray-100">
          <div className="bg-blue-600 px-8 py-6 text-white flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold">Analysis Report</h2>
              <p className="text-blue-100 mt-1">Patient ID: {patientId}</p>
            </div>
            <div className="flex items-center gap-3">
              {heatmapSrc ? (
                <button
                  onClick={handleViewHeatmap}
                  className="inline-flex items-center px-4 py-2 bg-white text-blue-600 rounded shadow-sm font-semibold hover:bg-blue-50 transition"
                >
                  <Eye className="h-4 w-4 mr-2" />
                  View Heatmap
                </button>
              ) : (
                <span className="text-blue-200 mt-2 font-semibold">Heatmap not available</span>
              )}
              {reportSrc ? (
                <button
                  onClick={handleDownloadPdf}
                  className="inline-flex items-center px-4 py-2 bg-white text-blue-600 rounded shadow-sm font-semibold hover:bg-blue-50 transition"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download PDF
                </button>
              ) : (
                <span className="text-blue-200 mt-2 font-semibold">PDF File not available</span>
              )}
            </div>
          </div>
          
          <div className="p-8 space-y-8">
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-md">
              <div className="flex">
                <div className="ml-3">
                  <p className="text-sm text-yellow-700 font-semibold mb-1">DISCLAIMER</p>
                  <p className="text-sm text-yellow-600">
                    This tool is for decision support only and does not constitute a clinical diagnosis. Always defer to a qualified medical professional.
                  </p>
                </div>
              </div>
            </div>

            {isLowConfidence && (
              <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-md">
                <div className="flex items-center">
                  <AlertTriangle className="h-5 w-5 text-red-500 mr-2" />
                  <p className="text-sm text-red-700 font-bold">
                    Confidence too low — recommend specialist review
                  </p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-6">
                <div className="bg-gray-50 p-6 rounded-xl border border-gray-100">
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Malignancy Probability</h3>
                  <div className="flex items-end">
                    <span className="text-6xl font-extrabold text-blue-600">{probStr}%</span>
                  </div>
                  
                  <div className="w-full bg-gray-200 rounded-full h-4 mt-4">
                    <div className="bg-blue-600 h-4 rounded-full" style={{ width: `${probStr}%` }}></div>
                  </div>
                </div>

                <div className="bg-gray-50 p-6 rounded-xl border border-gray-100">
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Confidence Interval (95%)</h3>
                  <p className="text-2xl font-bold text-gray-700">
                    [{(result.confidence_low * 100).toFixed(1)}%, {(result.confidence_high * 100).toFixed(1)}%]
                  </p>
                  <p className="text-sm text-gray-500 mt-2">
                    Model Version: {result.model_version}
                  </p>
                </div>
              </div>

              <div className="bg-gray-50 p-6 rounded-xl border border-gray-100 flex flex-col">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Grad-CAM Explanation</h3>
                <div className="flex-1 flex items-center justify-center bg-black rounded-lg overflow-hidden relative">
                   {heatmapSrc ? (
                     <img 
                      src={heatmapSrc} 
                      alt="Grad-CAM Heatmap" 
                      className="w-full h-auto object-contain max-h-80"
                     />
                   ) : (
                     <p className="text-red-400 font-semibold p-4">Heatmap File not available</p>
                   )}
                </div>
                <p className="text-xs text-gray-500 mt-3 text-center">
                  Regions with warmer colours higher influence the model's decision towards malignancy.
                </p>
              </div>
            </div>
            
          </div>
        </div>
      </main>
    </div>
  )
}
