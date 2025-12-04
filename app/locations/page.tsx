'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useOrganizationList } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { convertLocalTimeToUTC, convertUTCToLocalTime, getUserTimezone } from '@/lib/timezones'

interface Location {
  id: string
  name: string
  address: string
  kitchen_close: string
  operator_count?: number
}

interface LocationFormData {
  name: string
  address: string
  kitchenClose: string
}

export default function LocationsPage() {
  const [locations, setLocations] = useState<Location[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const { userMemberships } = useOrganizationList({ userMemberships: { infinite: true } })
  const router = useRouter()

  const formatTime = (time: string) => {
    if (!time) return ''
    const [hours, minutes] = time.split(':').map(Number)
    const period = hours >= 12 ? 'PM' : 'AM'
    const displayHours = hours % 12 || 12
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`
  }

  const [formData, setFormData] = useState<LocationFormData>({
    name: '',
    address: '',
    kitchenClose: ''
  })

  const orgId = userMemberships?.data?.[0]?.organization?.id

  useEffect(() => {
    loadLocations()
  }, [orgId])

  const loadLocations = async () => {
    if (!orgId) return

    setLoading(true)
    try {
      // Get locations with operator count
      const { data: locs, error } = await supabase
        .from('locations')
        .select('*, collaborators(count)')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error loading locations:', error)
        return
      }

      // Transform data to include operator count and convert UTC to app timezone
      const appTimezone = 'America/Bogota'
      const locationsWithCount = locs?.map(loc => ({
        id: loc.id,
        name: loc.name,
        address: loc.address,
        kitchen_close: convertUTCToLocalTime(loc.kitchen_close, appTimezone),
        operator_count: loc.collaborators?.[0]?.count || 0
      })) || []

      setLocations(locationsWithCount)
    } finally {
      setLoading(false)
    }
  }

  const handleSaveLocation = async () => {
    if (!formData.name || !formData.address || !formData.kitchenClose) {
      alert('Please fill in all fields')
      return
    }

    setSaving(true)
    try {
      const appTimezone = 'America/Bogota'
      const { error } = await supabase.from('locations').insert({
        organization_id: orgId,
        name: formData.name,
        address: formData.address,
        kitchen_close: convertLocalTimeToUTC(formData.kitchenClose, appTimezone)
      })

      if (error) {
        console.error('Error saving location:', error)
        alert(`Failed to save location. Error: ${error.message}`)
        return
      }

      // Reset form and close modal
      setFormData({ name: '', address: '', kitchenClose: '' })
      setShowModal(false)

      // Reload locations
      loadLocations()
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Locations</h1>
            <p className="text-sm text-gray-500 mt-1">Manage your restaurant locations</p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg font-medium hover:shadow-lg transition-all duration-200 flex items-center gap-2"
          >
            <span className="text-lg">+</span>
            Create Location
          </button>
        </div>

        {/* Locations Grid */}
        {locations.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border-2 border-dashed border-gray-300">
            <div className="text-4xl mb-3">📍</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">No locations yet</h3>
            <p className="text-gray-500 mb-4">Create your first location to get started</p>
            <button
              onClick={() => setShowModal(true)}
              className="px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg font-medium hover:shadow-lg transition-all duration-200"
            >
              Create Location
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {locations.map((location) => (
              <button
                key={location.id}
                onClick={() => router.push(`/locations/${location.id}`)}
                className="bg-white rounded-xl border-2 border-gray-200 p-6 hover:border-blue-500 hover:shadow-lg transition-all duration-200 text-left"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="text-3xl">📍</div>
                  <div className="bg-blue-50 text-blue-600 text-xs font-medium px-2 py-1 rounded-full">
                    {location.operator_count} operators
                  </div>
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">{location.name}</h3>
                <p className="text-sm text-gray-600 mb-3">{location.address}</p>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span>🕐</span>
                  <span>Kitchen closes at {convertUTCToLocalTime(location.kitchen_close)}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Create Location Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">Create Location</h2>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="px-6 py-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Location Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Downtown Branch"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-0 transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Address
                </label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="e.g., 123 Main St, City"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-0 transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Kitchen Close Time (Bogota time)
                </label>
                <div className="relative">
                  <input
                    type="time"
                    value={formData.kitchenClose}
                    onChange={(e) => setFormData({ ...formData, kitchenClose: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-0 transition-colors"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                    🕐
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-1">Time in Bogota timezone, saved in UTC automatically</p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="sticky bottom-0 bg-gray-50 px-6 py-4 rounded-b-2xl border-t border-gray-200 flex gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-lg font-medium text-gray-700 hover:bg-gray-100 transition-colors"
                disabled={saving}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveLocation}
                disabled={saving}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg font-medium hover:shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving...' : 'Save Location'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
