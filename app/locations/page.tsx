'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useOrganizationList } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { convertLocalTimeToTIMETZ, extractTimezoneFromTIMETZ, getUserTimezone, TIMEZONES } from '@/lib/timezones'
import AddressAutocomplete from '@/components/address-autocomplete'

interface Location {
  id: string
  name: string
  address: string
  kitchen_close: string
  restaurant_type?: string
  restaurant_size?: string
  cuisine_type?: string
  operator_count?: number
  opening_date?: string // Fecha de apertura del restaurante
}

interface LocationFormData {
  name: string
  address: string
  latitude?: number
  longitude?: number
  timezone: string
  kitchenClose: string
  restaurant_type?: string
  restaurant_size?: string
  cuisine_type?: string
  openingDate?: string // Fecha de apertura del restaurante
}

export default function LocationsPage() {
  const [locations, setLocations] = useState<Location[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editingLocation, setEditingLocation] = useState<Location | null>(null)
  const { userMemberships } = useOrganizationList({ userMemberships: { infinite: true } })
  const router = useRouter()

  const formatTime = (time: string) => {
    if (!time) return ''
    // Extract time part from TIMETZ format (e.g., "22:00:00-05" -> "22:00")
    const timePart = time.split(/[+-]/)[0] // Split by + or - to get time part
    const [hours, minutes] = timePart.split(':').map(Number)
    const period = hours >= 12 ? 'PM' : 'AM'
    const displayHours = hours % 12 || 12
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`
  }

  const [formData, setFormData] = useState<LocationFormData>({
    name: '',
    address: '',
    latitude: undefined,
    longitude: undefined,
    timezone: 'America/New_York',
    kitchenClose: '',
    restaurant_type: '',
    restaurant_size: '',
    cuisine_type: '',
    openingDate: ''
  })

  const orgId = userMemberships?.data?.[0]?.organization?.id

  const handleAddressChange = (address: string, lat?: number, lng?: number, timezone?: string) => {
    console.log('🏠 Locations: handleAddressChange called:', { address, lat, lng, timezone })
    
    setFormData(prev => {
      const isTimezoneUpdate = timezone && prev.timezone !== timezone
      if (isTimezoneUpdate && editingLocation) {
        console.log('🌍 Locations: Timezone updated during edit:', { 
          from: prev.timezone, 
          to: timezone,
          location: editingLocation.name 
        })
      }
      
      return {
        ...prev,
        address,
        latitude: lat,
        longitude: lng,
        // Always update timezone when address changes (both create and edit modes)
        timezone: timezone || prev.timezone || 'America/Bogota'
      }
    })
  }

  useEffect(() => {
    loadLocations()
  }, [orgId])

  useEffect(() => {
    console.log("Form data changed:", formData);
  }, [formData])

  // Effect to ensure timezone is set when editing
  useEffect(() => {
    if (editingLocation && showModal) {
      console.log("Modal opened for editing, current formData timezone:", formData.timezone);
    }
  }, [editingLocation, showModal, formData.timezone])

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

      // Transform data to include operator count
      const locationsWithCount = locs?.map(loc => ({
        id: loc.id,
        name: loc.name,
        address: loc.address,
        kitchen_close: loc.kitchen_close, // Already in restaurant's timezone from DB
        operator_count: loc.collaborators?.[0]?.count || 0
      })) || []

      setLocations(locationsWithCount)
    } finally {
      setLoading(false)
    }
  }

  const handleEditLocation = (location: Location) => {
    console.log("Editing location:", location);
    console.log("Kitchen close time:", location.kitchen_close);

    // Extract time part from TIMETZ (e.g., "22:00:00-05:00" -> "22:00")
    const timePart = location.kitchen_close.split(/[+-]/)[0]
    const timeForInput = timePart.substring(0, 5) // Get HH:MM
    console.log("Time for input:", timeForInput);

    // Extract timezone from TIMETZ offset and map to IANA timezone
    const extractedTimezone = extractTimezoneFromTIMETZ(location.kitchen_close)
    console.log("Extracted timezone:", extractedTimezone);

    setEditingLocation(location)
    setFormData({
      name: location.name,
      address: location.address,
      latitude: undefined, // You might want to store and load these from DB
      longitude: undefined,
      timezone: extractedTimezone,
      kitchenClose: timeForInput,
      restaurant_type: location.restaurant_type || '',
      restaurant_size: location.restaurant_size || '',
      cuisine_type: location.cuisine_type || '',
      openingDate: location.opening_date || ''
    })
    setShowModal(true)
  }

  const handleSaveLocation = async () => {
    if (!formData.name || !formData.address || !formData.kitchenClose) {
      alert('Please fill in all fields')
      return
    }

    setSaving(true)
    try {
      if (editingLocation) {
        // Update existing location
        const { error } = await supabase
          .from('locations')
          .update({
            name: formData.name,
            address: formData.address,
            latitude: formData.latitude,
            longitude: formData.longitude,
            kitchen_close: convertLocalTimeToTIMETZ(formData.kitchenClose, formData.timezone),
            restaurant_type: formData.restaurant_type || null,
            restaurant_size: formData.restaurant_size || null,
            cuisine_type: formData.cuisine_type || null,
            opening_date: formData.openingDate || null
          })
          .eq('id', editingLocation.id)

        if (error) {
          console.error('Error updating location:', error)
          alert(`Failed to update location. Error: ${error.message}`)
          return
        }
      } else {
        // Create new location
        const { error } = await supabase.from('locations').insert({
          organization_id: orgId,
          name: formData.name,
          address: formData.address,
          latitude: formData.latitude,
          longitude: formData.longitude,
          kitchen_close: convertLocalTimeToTIMETZ(formData.kitchenClose, formData.timezone),
          restaurant_type: formData.restaurant_type || null,
          restaurant_size: formData.restaurant_size || null,
          cuisine_type: formData.cuisine_type || null,
          opening_date: formData.openingDate || null
        })

        if (error) {
          console.error('Error saving location:', error)
          alert(`Failed to save location. Error: ${error.message}`)
          return
        }
      }

      // Reset form and close modal
      setFormData({ 
        name: '', 
        address: '', 
        latitude: undefined, 
        longitude: undefined, 
        timezone: 'America/New_York', 
        kitchenClose: '',
        restaurant_type: '',
        restaurant_size: '',
        cuisine_type: '',
        openingDate: ''
      })
      setEditingLocation(null)
      setShowModal(false)

      // Reload locations
      loadLocations()
    } finally {
      setSaving(false)
    }
  }

  const handleCloseModal = () => {
    setShowModal(false)
    setEditingLocation(null)
    setFormData({ name: '', address: '', latitude: undefined, longitude: undefined, timezone: 'America/New_York', kitchenClose: '' })
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
            Location
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
              <div key={location.id} className="bg-white rounded-xl border-2 border-gray-200 hover:border-blue-500 hover:shadow-lg transition-all duration-200 relative group">
                {/* Edit button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleEditLocation(location)
                  }}
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-2 bg-white rounded-lg shadow-md hover:shadow-lg"
                  title="Edit location"
                >
                  <svg className="w-4 h-4 text-gray-600 hover:text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>

                {/* Main clickable area */}
                <button
                  onClick={() => router.push(`/locations/${location.id}`)}
                  className="w-full p-6 text-left"
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
                    <span>Kitchen closes at {formatTime(location.kitchen_close)}</span>
                  </div>
                  {location.opening_date && (
                    <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                      <span>📅</span>
                      <span>Opened: {location.opening_date}</span>
                    </div>
                  )}
                  </div>
                </button>
              </div>
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
                <h2 className="text-xl font-bold text-gray-900">{editingLocation ? 'Edit Location' : 'Create Location'}</h2>
                <button
                  onClick={handleCloseModal}
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
                                Fecha de apertura
                              </label>
                              <input
                                type="date"
                                value={formData.openingDate || ''}
                                onChange={(e) => setFormData({ ...formData, openingDate: e.target.value })}
                                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-0 transition-colors"
                              />
                            </div>
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
                  Kitchen Close Time
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
                <p className="text-xs text-gray-500 mt-1">Time will be saved with timezone automatically based on address</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Address
                </label>
                <AddressAutocomplete
                  value={formData.address}
                  onChange={handleAddressChange}
                  placeholder="e.g., 123 Main St, City"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-0 transition-colors"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Restaurant Type
                  </label>
                  <select
                    value={formData.restaurant_type || ''}
                    onChange={(e) => setFormData({ ...formData, restaurant_type: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-0 transition-colors"
                  >
                    <option value="">Select type</option>
                    <option value="fast_food">Fast Food</option>
                    <option value="casual_dining">Casual Dining</option>
                    <option value="fine_dining">Fine Dining</option>
                    <option value="cafe">Cafe</option>
                    <option value="food_truck">Food Truck</option>
                    <option value="bakery">Bakery</option>
                    <option value="bar">Bar</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Restaurant Size
                  </label>
                  <select
                    value={formData.restaurant_size || ''}
                    onChange={(e) => setFormData({ ...formData, restaurant_size: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-0 transition-colors"
                  >
                    <option value="">Select size</option>
                    <option value="small">Small</option>
                    <option value="medium">Medium</option>
                    <option value="large">Large</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Cuisine Type
                </label>
                <select
                  value={formData.cuisine_type || ''}
                  onChange={(e) => setFormData({ ...formData, cuisine_type: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-0 transition-colors"
                >
                  <option value="">Select cuisine</option>
                  <option value="italian">Italian</option>
                  <option value="mexican">Mexican</option>
                  <option value="american">American</option>
                  <option value="asian">Asian</option>
                  <option value="indian">Indian</option>
                  <option value="mediterranean">Mediterranean</option>
                  <option value="french">French</option>
                  <option value="japanese">Japanese</option>
                  <option value="chinese">Chinese</option>
                  <option value="thai">Thai</option>
                  <option value="vietnamese">Vietnamese</option>
                  <option value="korean">Korean</option>
                  <option value="greek">Greek</option>
                  <option value="spanish">Spanish</option>
                  <option value="brazilian">Brazilian</option>
                  <option value="peruvian">Peruvian</option>
                  <option value="colombian">Colombian</option>
                  <option value="fusion">Fusion</option>
                  <option value="international">International</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="sticky bottom-0 bg-gray-50 px-6 py-4 rounded-b-2xl border-t border-gray-200 flex gap-3">
              <button
                onClick={handleCloseModal}
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
                {saving ? (editingLocation ? 'Updating...' : 'Saving...') : (editingLocation ? 'Update Location' : 'Save Location')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
