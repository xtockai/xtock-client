'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { convertTIMETZToLocalTime, convertLocalTimeToTIMETZ, getUserTimezone, TIMEZONES } from '@/lib/timezones'

interface Location {
  id: string
  name: string
  address: string
  kitchen_close: string
  timezone?: string
  organization_id: string
}

interface Operator {
  id: string
  contact_type: 'phone' | 'email'
  contact_value: string
  country_code?: string
}

interface OperatorFormData {
  contactType: 'phone' | 'email'
  contactValue: string
  countryCode: string
}

export default function LocationDetailPage() {
  const params = useParams()
  const router = useRouter()
  const locationId = params.id as string

  const [location, setLocation] = useState<Location | null>(null)
  const [operators, setOperators] = useState<Operator[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [isEditing, setIsEditing] = useState(false)

  const formatTime = (time: string) => {
    if (!time) return ''
    // Extract time part from TIMETZ format (e.g., "22:00:00-05" -> "22:00")
    const timePart = time.split(/[+-]/)[0] // Split by + or - to get time part
    const [hours, minutes] = timePart.split(':').map(Number)
    const period = hours >= 12 ? 'PM' : 'AM'
    const displayHours = hours % 12 || 12
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`
  }

  const [formData, setFormData] = useState<OperatorFormData>({
    contactType: 'email',
    contactValue: '',
    countryCode: '+1'
  })

  const [editFormData, setEditFormData] = useState({
    name: '',
    timezone: 'America/New_York',
    kitchenClose: ''
  })

  useEffect(() => {
    loadData()
  }, [locationId])

  const loadData = async () => {
    setLoading(true)
    try {
      // Load location
      const { data: loc, error: locError } = await supabase
        .from('locations')
        .select('*')
        .eq('id', locationId)
        .maybeSingle()

      if (locError) {
        console.error('Error loading location:', locError)
        return
      }

      if (!loc) {
        router.push('/locations')
        return
      }

      // Kitchen close already comes in restaurant's timezone from DB (TIMETZ)
      setLocation({
        ...loc,
        timezone: 'America/New_York', // Default timezone for form display
        kitchen_close: loc.kitchen_close
      })

      // Load operators
      const { data: ops, error: opsError } = await supabase
        .from('collaborators')
        .select('*')
        .eq('location_id', locationId)
        .order('created_at', { ascending: false })

      if (opsError) {
        console.error('Error loading operators:', opsError)
        return
      }

      setOperators(ops || [])
    } finally {
      setLoading(false)
    }
  }

  const handleStartEdit = () => {
    if (!location) return
    // Extract time part from TIMETZ (e.g., "22:00:00-05" -> "22:00")
    const timePart = location.kitchen_close.split(/[+-]/)[0]
    const timeForInput = timePart.substring(0, 5) // Get HH:MM

    setEditFormData({
      name: location.name,
      timezone: 'America/New_York', // Default timezone for editing
      kitchenClose: timeForInput
    })
    setShowEditModal(true)
  }

  const handleCancelEdit = () => {
    setShowEditModal(false)
    setEditFormData({
      name: '',
      timezone: 'America/New_York',
      kitchenClose: ''
    })
  }

  const handleUpdateLocation = async () => {
    if (!editFormData.name || !editFormData.kitchenClose) {
      alert('Please fill in all fields')
      return
    }

    setSaving(true)
    try {
      const appTimezone = 'America/New_York'
      const { error } = await supabase
        .from('locations')
        .update({
          name: editFormData.name,
          kitchen_close: convertLocalTimeToTIMETZ(editFormData.kitchenClose, editFormData.timezone)
        })
        .eq('id', locationId)

      if (error) {
        console.error('Error updating location:', error)
        alert(`Failed to update location. Error: ${error.message}`)
        return
      }

      // Reset edit mode and reload data
      setShowEditModal(false)
      setEditFormData({
        name: '',
        timezone: 'America/New_York',
        kitchenClose: ''
      })
      loadData()
    } finally {
      setSaving(false)
    }
  }

  const handleSaveOperator = async () => {
    if (!formData.contactValue) {
      alert('Please enter a contact value')
      return
    }

    // Validate email
    if (formData.contactType === 'email' && !formData.contactValue.includes('@')) {
      alert('Please enter a valid email address')
      return
    }

    setSaving(true)
    try {
      const insertData: any = {
        location_id: locationId,
        organization_id: location?.organization_id,
        contact_type: formData.contactType,
        contact_value: formData.contactValue
      }

      // Add country code if phone
      if (formData.contactType === 'phone') {
        insertData.country_code = formData.countryCode
      }

      const { error } = await supabase.from('collaborators').insert(insertData)

      if (error) {
        console.error('Error saving operator:', error)
        alert(`Failed to save operator. Error: ${error.message}`)
        return
      }

      // Reset form and close modal
      setFormData({ contactType: 'email', contactValue: '', countryCode: '+1' })
      setShowModal(false)

      // Reload operators
      loadData()
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

  if (!location) {
    return null
  }

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <Link
            href="/locations"
            className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-4 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Locations
          </Link>

          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{location.name}</h1>
              <p className="text-sm text-gray-600 mt-1">{location.address}</p>
              <div className="flex items-center gap-2 text-xs text-gray-500 mt-2">
                <span>🕐</span>
                <span>Kitchen closes at {formatTime(location.kitchen_close)}</span>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleStartEdit}
                className="px-4 py-2 border-2 border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-all duration-200 flex items-center gap-2"
              >

                Edit
              </button>
             
            </div>
          </div>
        </div>

        {/* Operators Section */}
        <div className="bg-white rounded-xl border-2 border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Operators</h2>
              <p className="text-sm text-gray-500 mt-1">Manage operators for this location</p>
            </div>
            <button
              onClick={() => setShowModal(true)}
              className="px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg font-medium hover:shadow-lg transition-all duration-200 flex items-center gap-2"
            >
              <span className="text-lg">+</span>
            </button>
          </div>

          {operators.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-4xl mb-3">👥</div>
              <h3 className="text-lg font-semibold text-gray-900 mb-1">No operators yet</h3>
              <p className="text-gray-500 mb-4">Add your first operator to get started</p>
              <button
                onClick={() => setShowModal(true)}
                className="px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg font-medium hover:shadow-lg transition-all duration-200"
              >
                Create Operator
              </button>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {operators.map((operator) => (
                <div key={operator.id} className="px-6 py-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 flex items-center justify-center text-white font-semibold overflow-hidden">
                      {operator.contact_type === 'email' ? (
                        '✉️'
                      ) : (
                        <img
                          src="/wp.gif"
                          alt="WhatsApp"
                          className="w-full h-full object-cover rounded-full"
                        />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-gray-900">
                        {operator.contact_type === 'phone' ? (
                          <span>
                            {operator.country_code} {operator.contact_value}
                          </span>
                        ) : (
                          <span>{operator.contact_value}</span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 capitalize">{operator.contact_type}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Create Operator Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">Create Operator</h2>
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
                  Contact Type
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setFormData({ ...formData, contactType: 'email' })}
                    className={`px-4 py-3 rounded-lg font-medium transition-all border-2 ${
                      formData.contactType === 'email'
                        ? 'bg-blue-50 border-blue-500 text-blue-600'
                        : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    ✉️ Email
                  </button>
                  <button
                    onClick={() => setFormData({ ...formData, contactType: 'phone' })}
                    className={`px-4 py-3 rounded-lg font-medium transition-all border-2 ${
                      formData.contactType === 'phone'
                        ? 'bg-blue-50 border-blue-500 text-blue-600'
                        : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    📱 Phone
                  </button>
                </div>
              </div>

              {formData.contactType === 'email' ? (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={formData.contactValue}
                    onChange={(e) => setFormData({ ...formData, contactValue: e.target.value })}
                    placeholder="operator@example.com"
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-0 transition-colors"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Phone Number
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={formData.countryCode}
                      onChange={(e) => setFormData({ ...formData, countryCode: e.target.value })}
                      className="w-20 sm:w-28 px-2 sm:px-3 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-0 transition-colors text-sm"
                    >
                      <option value="+1">🇺🇸 +1</option>
                      <option value="+52">🇲🇽 +52</option>
                      <option value="+44">🇬🇧 +44</option>
                      <option value="+33">🇫🇷 +33</option>
                      <option value="+49">🇩🇪 +49</option>
                      <option value="+39">🇮🇹 +39</option>
                      <option value="+34">🇪🇸 +34</option>
                      <option value="+55">🇧🇷 +55</option>
                      <option value="+54">🇦🇷 +54</option>
                      <option value="+57">🇨🇴 +57</option>
                      <option value="+56">🇨🇱 +56</option>
                      <option value="+51">🇵🇪 +51</option>
                      <option value="+81">🇯🇵 +81</option>
                      <option value="+86">🇨🇳 +86</option>
                      <option value="+91">🇮🇳 +91</option>
                      <option value="+61">🇦🇺 +61</option>
                    </select>
                    <input
                      type="tel"
                      value={formData.contactValue}
                      onChange={(e) => setFormData({ ...formData, contactValue: e.target.value })}
                      placeholder="555 000 0000"
                      className="flex-1 min-w-0 px-3 sm:px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-0 transition-colors"
                    />
                  </div>
                </div>
              )}
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
                onClick={handleSaveOperator}
                disabled={saving}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg font-medium hover:shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving...' : 'Save Operator'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Location Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">Edit Location</h2>
                <button
                  onClick={handleCancelEdit}
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
                  value={editFormData.name}
                  onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                  placeholder="Enter location name"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-0 transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Timezone
                </label>
                <div className="relative">
                  <select
                    value={editFormData.timezone}
                    onChange={(e) => setEditFormData({ ...editFormData, timezone: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-0 transition-colors appearance-none cursor-pointer"
                  >
                    {TIMEZONES.map((tz) => (
                      <option key={tz.value} value={tz.value}>
                        {tz.label} ({tz.offset})
                      </option>
                    ))}
                  </select>
                  <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Kitchen Closing Time ({TIMEZONES.find(tz => tz.value === editFormData.timezone)?.label || 'Local time'})
                </label>
                <input
                  type="time"
                  value={editFormData.kitchenClose}
                  onChange={(e) => setEditFormData({ ...editFormData, kitchenClose: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-0 transition-colors"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="sticky bottom-0 bg-gray-50 px-6 py-4 rounded-b-2xl border-t border-gray-200 flex gap-3">
              <button
                onClick={handleCancelEdit}
                className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-lg font-medium text-gray-700 hover:bg-gray-100 transition-colors"
                disabled={saving}
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateLocation}
                disabled={saving}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg font-medium hover:shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Updating...' : 'Update Location'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
