'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import DemoCSVUpload from '@/components/demo-csv-upload'

interface CSVData {
  date: string
  item: string
  quantity: number
}

export default function CreateDemoPage() {
  const [restaurantName, setRestaurantName] = useState('')
  const [showUpload, setShowUpload] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const router = useRouter()

  const handleUploadClick = () => {
    if (!restaurantName.trim()) {
      setError('Please enter a restaurant name')
      return
    }
    setError('')
    setShowUpload(true)
  }

  const handleUpload = async (csvData: CSVData[]) => {
    setUploading(true)
    setError('')
    setSuccess('')

    try {
      const res = await fetch('/api/demo-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurant: restaurantName.trim(),
          csvData,
        }),
      })

      const data = await res.json()

      if (data.success) {
        setSuccess(`Successfully uploaded ${data.newRecords} records (${data.duplicates} duplicates skipped)`)
        setShowUpload(false)
        // Transform restaurant name to key for navigation
        const restaurantKey = restaurantName.trim().toLowerCase().replace(/\s+/g, '')
        // Optionally redirect to the demo page
        setTimeout(() => {
          router.push(`/demo/${restaurantKey}`)
        }, 2000)
      } else {
        setError(data.error || 'Upload failed')
      }
    } catch (err) {
      setError('Network error during upload')
    } finally {
      setUploading(false)
    }
  }

  const handleError = (errorMsg: string) => {
    setError(errorMsg)
  }

  const handleClose = () => {
    setShowUpload(false)
  }

  return (
    <main className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-4">
      <div className="mb-6">
        <h1 className="text-3xl text-center font-bold text-indigo-900">Create Demo</h1>
        <p className="text-gray-600 text-center mt-2">Set up a demo restaurant with sales data</p>
      </div>

      <div className="bg-white p-8 rounded-lg shadow-lg w-full max-w-md">
        <div className="space-y-4">
          <div>
            <label htmlFor="restaurant" className="block text-sm font-medium text-gray-700 mb-1">
              Restaurant Name
            </label>
            <input
              id="restaurant"
              type="text"
              value={restaurantName}
              onChange={(e) => setRestaurantName(e.target.value)}
              placeholder="Enter restaurant name"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-400"
              required
            />
          </div>

          <button
            onClick={handleUploadClick}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-4 rounded transition disabled:opacity-60"
            disabled={!restaurantName.trim()}
          >
            Upload Sales Data CSV
          </button>

          {error && (
            <div className="text-red-500 text-sm text-center">{error}</div>
          )}

          {success && (
            <div className="text-green-600 text-sm text-center">{success}</div>
          )}
        </div>
      </div>

      {showUpload && (
        <DemoCSVUpload
          restaurantName={restaurantName}
          onUpload={handleUpload}
          onError={handleError}
          onClose={handleClose}
          uploading={uploading}
        />
      )}
    </main>
  )
}