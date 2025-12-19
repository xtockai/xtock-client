'use client'
import { useEffect, useState, useRef, startTransition } from 'react'
import { useUser, useOrganizationList } from '@clerk/nextjs'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { LandingHero } from "../app/_template/components/landing-hero";
import { LearnMore } from "../app/_template/components/learn-more";
import { Footer } from "../app/_template/components/footer";
import { CARDS } from "../app/_template/content/cards";
import LoadingComponent from './loading'
import AddressAutocomplete from './address-autocomplete'
import { convertLocalTimeToTIMETZ, extractTimezoneFromTIMETZ, getUserTimezone, TIMEZONES } from '@/lib/timezones'

interface Location {
  name: string
  address: string
  latitude?: number
  longitude?: number
  timezone: string
  kitchenClose: string
  collaborators: Collaborator[] // Add collaborators to each location
}

interface Collaborator {
  contactType: 'phone' | 'email'
  contactValue: string
  countryCode?: string
}

export default function Onboarding() {
  const { user } = useUser()
  const { userMemberships, createOrganization, isLoaded } = useOrganizationList({
    userMemberships: {
      infinite: true,
    },
  })
  const router = useRouter()

  const [step, setStep] = useState(1)
  const [completed, setCompleted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [expandedLocations, setExpandedLocations] = useState<Set<number>>(new Set())
  const [data, setData] = useState({
    orgName: '',
    adminName: user?.fullName || '',
    orgId: '',
    locations: [] as Location[],
    apiKey: ''
  })

  // Check if all locations have at least one operator
  const allLocationsHaveOperators = () => {
    return data.locations.length > 0 && data.locations.every(location => location.collaborators.length > 0)
  }

  const hasChecked = useRef(false)

  // Redirect to dashboard when onboarding is completed
  useEffect(() => {
    if (completed) {
      console.log('🔍 ONBOARDING: Redirecting to dashboard')
      router.push('/')
    }
  }, [completed, router])

  const steps = [
    'Basic Information',
    'Locations',
    'Operators',
    'POS Provider'
  ]

  useEffect(() => {
    const check = async () => {
      // Prevent multiple executions
      if (hasChecked.current) return
      
      // Wait for user memberships to load
      if (!isLoaded) {
        console.log('🔍 ONBOARDING: Still loading, waiting...')
        return
      }
      
      console.log('🔍 ONBOARDING: Starting check...')
      console.log('🔍 ONBOARDING: userMemberships ', userMemberships)

      // Only check for no memberships after isLoaded is true
      if (!userMemberships?.data || userMemberships.data.length === 0) {
        console.log('🔍 ONBOARDING: No memberships found, staying at step 1')
        setLoading(false)
        return
      }

      hasChecked.current = true

      const clerkOrgId = userMemberships.data[0].organization.id
      const clerkOrgName = userMemberships.data[0].organization.name
      console.log('🔍 ONBOARDING: Using organization ID:', clerkOrgId)
      console.log('🔍 ONBOARDING: Organization name from Clerk:', clerkOrgName)
      
      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', clerkOrgId)
        .maybeSingle()

      console.log('🔍 ONBOARDING: Supabase org data:', org)
      console.log('🔍 ONBOARDING: Supabase org error:', orgError)

      // If no organization exists in our DB, but exists in Clerk, prefill form and stay at step 1
      if (!org || orgError) {
        console.log('🔍 ONBOARDING: Organization exists in Clerk but not in Supabase, prefilling form')
        setData(prev => ({ 
          ...prev, 
          orgId: clerkOrgId,
          orgName: clerkOrgName || '' 
        }))
        setStep(1)
        setLoading(false)
        return
      }

      // If onboarding is completed, show completed state
      if (org.onboarding_completed) {
        console.log('🔍 ONBOARDING: Onboarding completed, setting completed state')
        setCompleted(true)
        setLoading(false)
        return
      }

      // Organization exists, prepare all data first
      let currentStep = 2
      let newData = {
        orgId: clerkOrgId,
        orgName: org.name,
        adminName: org.admin_name,
        locations: [] as Location[],
        collaborators: [] as Collaborator[],
        apiKey: ''
      }

      // Check for locations
      const { data: locs } = await supabase.from('locations').select('*').eq('organization_id', clerkOrgId)
      if (locs && locs.length > 0) {
        // Get all collaborators for all locations
        const { data: cols } = await supabase.from('collaborators').select('*').eq('organization_id', clerkOrgId)
        
        newData.locations = locs.map(l => {
          // Extract time part from TIMETZ (e.g., "22:00:00-05:00" -> "22:00")
          const timePart = l.kitchen_close.split(/[+-]/)[0]
          const timeForInput = timePart.substring(0, 5) // Get HH:MM

          // Extract timezone from TIMETZ offset and map to IANA timezone
          const extractedTimezone = extractTimezoneFromTIMETZ(l.kitchen_close)

          // Get collaborators for this specific location
          const locationCollaborators = cols?.filter(c => c.location_id === l.id).map(c => {
            // Parse phone numbers to separate country code
            if (c.contact_type === 'phone' && c.contact_value) {
              const phoneMatch = c.contact_value.match(/^(\+\d{1,4})(\d+)$/)
              if (phoneMatch) {
                return {
                  contactType: c.contact_type,
                  contactValue: phoneMatch[2],
                  countryCode: phoneMatch[1]
                }
              }
            }
            return {
              contactType: c.contact_type,
              contactValue: c.contact_value,
              countryCode: '+1'
            }
          }) || []

          return {
            name: l.name,
            address: l.address,
            latitude: l.latitude,
            longitude: l.longitude,
            timezone: extractedTimezone,
            kitchenClose: timeForInput,
            collaborators: locationCollaborators
          }
        })
        currentStep = 3

        // Check if any location has collaborators
        const hasCollaborators = newData.locations.some(loc => loc.collaborators.length > 0)
        if (hasCollaborators) {
          currentStep = 4

          // Check for credentials
          const { data: creds } = await supabase.from('credentials').select('*').eq('organization_id', clerkOrgId)
          if (creds && creds.length > 0) {
            // Has everything but onboarding not marked complete
            setCompleted(true)
            setLoading(false)
            return
          }
        }
      }

      // Update everything at once using startTransition
      startTransition(() => {
        setData(prev => ({ ...prev, ...newData }))
        setStep(currentStep)
        setLoading(false)
      })   
    }
    check()
  }, [userMemberships, router, isLoaded])

  const handleNext = async () => {
    if (step === 1) {
      try {
        // Validate required fields
        if (!data.orgName || !data.adminName) {
          alert('Please fill in all required fields')
          return
        }

        // Double check if user already has an organization before creating
        if (isLoaded && userMemberships?.data && userMemberships.data.length > 0) {
          console.log('🔍 ONBOARDING: User already has organization, checking if needs Supabase sync')
          const existingOrgId = userMemberships.data[0].organization.id
          
          // If we already have the orgId in state, just try to save to Supabase
          if (data.orgId === existingOrgId) {
            console.log('🔍 ONBOARDING: Syncing existing Clerk org to Supabase...')
            // Try to save to Supabase (will fail if already exists, which is fine)
            const { error } = await supabase
              .from('organizations')
              .insert({
                id: existingOrgId,
                name: data.orgName,
                admin_name: data.adminName,
                onboarding_completed: false
              })

            if (error && !error.message.includes('duplicate key')) {
              console.error('Error syncing organization to Supabase:', error)
              alert('Failed to sync organization data. Please try again.')
              return
            }

            setStep(2)
            return
          } else {
            // Different organization, just move to step 2
            setData(prev => ({ ...prev, orgId: existingOrgId }))
            setStep(2)
            return
          }
        }

        console.log('🔍 ONBOARDING: Creating new organization...')
        
        // Create organization in Clerk
        const clerkOrg = await createOrganization?.({ name: data.orgName })

        if (!clerkOrg) {
          alert('Failed to create organization. Please try again.')
          return
        }

        // Save to Supabase using Clerk org ID as the primary key
        const { error } = await supabase
          .from('organizations')
          .insert({
            id: clerkOrg.id,
            name: data.orgName,
            admin_name: data.adminName,
            onboarding_completed: false
          })

        if (error) {
          console.error('Error creating organization in Supabase:', error)
          alert('Failed to save organization. Please try again.')
          return
        }

        setData(prev => ({ ...prev, orgId: clerkOrg.id }))
        setStep(2)
      } catch (error) {
        console.error('Error in step 1:', error)
        alert('An error occurred. Please try again.')
      }
    } else if (step === 2) {
      try {
        // Validate at least one location
        if (data.locations.length === 0) {
          alert('Please add at least one location to continue')
          return
        }
        // Validate location fields are filled
        const hasEmptyFields = data.locations.some(loc => !loc.name || !loc.address || !loc.kitchenClose)
        if (hasEmptyFields) {
          alert('Please fill in all location fields')
          return
        }
        
        // First, delete all existing locations for this organization
        // This will cascade delete collaborators due to foreign key constraints
        const { error: deleteError } = await supabase
          .from('locations')
          .delete()
          .eq('organization_id', data.orgId)

        if (deleteError) {
          console.error('Error deleting existing locations:', deleteError)
          alert('Failed to update locations. Please try again.')
          return
        }

        // Save locations
        for (const loc of data.locations) {
          const { error } = await supabase.from('locations').insert({
            organization_id: data.orgId,
            name: loc.name,
            address: loc.address,
            latitude: loc.latitude,
            longitude: loc.longitude,
            kitchen_close: convertLocalTimeToTIMETZ(loc.kitchenClose, loc.timezone)
          })

          if (error) {
            console.error('Error saving location:', error)
            alert(`Failed to save location "${loc.name}". Error: ${error.message}`)
            return
          }
        }
        setStep(3)
      } catch (error) {
        console.error('Error in step 2:', error)
        alert('An error occurred while saving locations. Please try again.')
      }
    } else if (step === 3) {
      try {
        // Validate collaborator fields are filled for all locations
        for (const location of data.locations) {
          if (location.collaborators.length > 0) {
            const hasEmptyFields = location.collaborators.some(col => 
              !col.contactValue.trim() || 
              (col.contactType === 'phone' && !col.countryCode)
            )
            if (hasEmptyFields) {
              alert(`Please fill in all operator fields for location "${location.name}"`)
              return
            }
          }
        }

        // Get location IDs from database (these should match the locations we just saved)
        const { data: locationRecords } = await supabase
          .from('locations')
          .select('id, name')
          .eq('organization_id', data.orgId)

        if (!locationRecords || locationRecords.length === 0) {
          alert('No locations found. Please go back and add locations first.')
          return
        }

        // Delete all existing collaborators for this organization
        const { error: deleteError } = await supabase
          .from('collaborators')
          .delete()
          .eq('organization_id', data.orgId)

        if (deleteError) {
          console.error('Error deleting existing collaborators:', deleteError)
          alert('Failed to update operators. Please try again.')
          return
        }

        // Save collaborators for each location
        for (const location of data.locations) {
          // Find the corresponding location record by name
          const locationRecord = locationRecords.find(loc => loc.name === location.name)
          if (!locationRecord) {
            console.warn(`Location "${location.name}" not found in database`)
            continue
          }

          for (const col of location.collaborators) {
            // Format phone number with country code
            const contactValue = col.contactType === 'phone'
              ? `${col.countryCode || '+1'}${col.contactValue.replace(/\s/g, '')}`
              : col.contactValue

            // Insert collaborator
            const { error } = await supabase.from('collaborators').insert({
              organization_id: data.orgId,
              location_id: locationRecord.id,
              contact_type: col.contactType,
              contact_value: contactValue
            })

            if (error) {
              console.error('Error saving collaborator:', error)
              alert(`Failed to save operator for location "${location.name}". Error: ${error.message}`)
              return
            }
          }
        }
        setStep(4)
      } catch (error) {
        console.error('Error in step 3:', error)
        alert('An error occurred while saving operators. Please try again.')
      }
    } else if (step === 4) {
      try {
        // Validate API key
        if (!data.apiKey) {
          alert('Please enter your Toast API key')
          return
        }

        // Save credentials
        const response = await fetch('/api/credentials', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orgId: data.orgId, name: 'toast', apiKey: data.apiKey })
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.message || 'Failed to save credentials')
        }

        // Mark onboarding as completed
        const { error } = await supabase.from('organizations').update({ onboarding_completed: true }).eq('id', data.orgId)

        if (error) {
          console.error('Error marking onboarding as complete:', error)
          alert(`Failed to complete onboarding. Error: ${error.message}`)
          return
        }

        setCompleted(true)
      } catch (error) {
        console.error('Error in step 4:', error)
        alert(`An error occurred: ${error instanceof Error ? error.message : 'Please try again.'}`)
      }
    }
  }

  const addLocation = () => {
    setData(prev => ({
      ...prev,
      locations: [...prev.locations, { 
        name: '', 
        address: '', 
        latitude: undefined, 
        longitude: undefined, 
        timezone: getUserTimezone(), 
        kitchenClose: '',
        collaborators: []
      }]
    }))
  }

  const removeLocation = (index: number) => {
    setData(prev => ({
      ...prev,
      locations: prev.locations.filter((_, i) => i !== index)
    }))
  }

  const updateLocation = (index: number, field: keyof Location, value: string | number | undefined) => {
    setData(prev => ({
      ...prev,
      locations: prev.locations.map((loc, i) => i === index ? { ...loc, [field]: value } : loc)
    }))
  }

  const updateLocationAddress = (index: number, address: string, lat?: number, lng?: number, timezone?: string) => {
    console.log('🏠 Onboarding: updateLocationAddress called:', { index, address, lat, lng, timezone })
    setData(prev => ({
      ...prev,
      locations: prev.locations.map((loc, i) => i === index ? { 
        ...loc, 
        address, 
        latitude: lat, 
        longitude: lng,
        timezone: timezone || 'America/Bogota' // Always use new timezone from address
      } : loc)
    }))
  }

  const addCollaborator = (locationIndex: number) => {
    setData(prev => ({
      ...prev,
      locations: prev.locations.map((loc, i) => 
        i === locationIndex 
          ? { ...loc, collaborators: [...loc.collaborators, { contactType: 'phone', contactValue: '', countryCode: '+1' }] }
          : loc
      )
    }))
    
    // Automatically open the accordion when adding a collaborator
    setExpandedLocations(prev => {
      const newSet = new Set(prev)
      newSet.add(locationIndex)
      return newSet
    })
  }

  const removeCollaborator = (locationIndex: number, collaboratorIndex: number) => {
    setData(prev => ({
      ...prev,
      locations: prev.locations.map((loc, i) => 
        i === locationIndex 
          ? { ...loc, collaborators: loc.collaborators.filter((_, colIndex) => colIndex !== collaboratorIndex) }
          : loc
      )
    }))
  }

  const updateCollaborator = (locationIndex: number, collaboratorIndex: number, field: keyof Collaborator, value: string) => {
    setData(prev => ({
      ...prev,
      locations: prev.locations.map((loc, i) => 
        i === locationIndex 
          ? { 
              ...loc, 
              collaborators: loc.collaborators.map((col, colI) => 
                colI === collaboratorIndex ? { ...col, [field]: value } : col
              ) 
            }
          : loc
      )
    }))
  }

  const toggleLocationAccordion = (locationIndex: number) => {
    setExpandedLocations(prev => {
      const newSet = new Set(prev)
      if (newSet.has(locationIndex)) {
        newSet.delete(locationIndex)
      } else {
        newSet.add(locationIndex)
      }
      return newSet
    })
  }

  // Loading screen or redirecting
  if (loading || completed) {
   return <LoadingComponent />
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center sm:mb-2 md:mb-12">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome to Xtock</h1>
          <p className="text-lg text-gray-600">Let's get your organization set up in a few simple steps</p>
        </div>
 
        {/* Modern Stepper */}
        <div className="xs:mb-4 sm:mb-12">
          {/* Mobile Compact Stepper */}
          <div className="sm:hidden">
            <div className="flex items-center justify-center gap-3 py-4">
              {/* Current Step Circle */}
              <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 text-white flex items-center justify-center text-sm font-bold shadow-lg">
                {step}
              </div>

              {/* Current Step Info */}
              <div className="flex-1">
                <p className="text-xs text-gray-500 font-medium">Step {step} of {steps.length}</p>
                <p className="text-base font-bold text-gray-900">{steps[step - 1]}</p>
              </div>

              {/* Progress Dots */}
              <div className="flex gap-1.5">
                {steps.map((_, i) => (
                  <div
                    key={i}
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      i + 1 === step
                        ? 'w-6 bg-gradient-to-r from-blue-500 to-indigo-600'
                        : i + 1 < step
                        ? 'w-1.5 bg-blue-400'
                        : 'w-1.5 bg-gray-300'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Desktop Horizontal Stepper */}
          <div className="hidden sm:block">
            <div className="relative">
              {/* Progress Line */}
              <div className="absolute top-5 left-0 w-full h-1 bg-gray-200 rounded-full">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${((step - 1) / (steps.length - 1)) * 100}%` }}
                />
              </div>

              {/* Steps */}
              <div className="relative flex justify-between">
                {steps.map((s, i) => {
                  const isActive = i + 1 === step
                  const isCompleted = i + 1 < step
                  const isPending = i + 1 > step

                  return (
                    <div key={i} className="flex-1 flex flex-col items-center relative">
                      {/* Step Circle */}
                      <div className={`
                        relative z-10 w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold
                        transition-all duration-300 ease-out transform
                        ${isCompleted ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white scale-100 shadow-lg' : ''}
                        ${isActive ? 'bg-white text-blue-600 scale-110 shadow-xl ring-4 ring-blue-100' : ''}
                        ${isPending ? 'bg-gray-200 text-gray-400 scale-100' : ''}
                      `}>
                        {isCompleted ? (
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <span>{i + 1}</span>
                        )}
                      </div>

                      {/* Step Label */}
                      <div className={`
                        mt-3 text-center transition-all duration-300
                        ${isActive ? 'text-blue-600 font-semibold' : ''}
                        ${isCompleted ? 'text-gray-700 font-medium' : ''}
                        ${isPending ? 'text-gray-400' : ''}
                      `}>
                        <p className="text-sm whitespace-nowrap">{s}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Content Card */}
        <div className="bg-white rounded-2xl shadow-xl p-4 sm:p-10 backdrop-blur-sm bg-opacity-95 border border-gray-100">

      {step === 1 && (
        <div className="animate-fadeIn">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Basic Information</h2>
            <p className="text-gray-600">Tell us about your organization</p>
          </div>
          <div className="space-y-6">
            <div className="group">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Organization Name
              </label>
              <input
                type="text"
                placeholder="Enter your organization name"
                value={data.orgName}
                onChange={(e) => setData(prev => ({ ...prev, orgName: e.target.value }))}
                className="w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all outline-none group-hover:border-gray-300 bg-gray-50 focus:bg-white"
              />
            </div>
            <div className="group">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Admin Name
              </label>
              <input
                type="text"
                placeholder="Enter admin name"
                value={data.adminName}
                onChange={(e) => setData(prev => ({ ...prev, adminName: e.target.value }))}
                className="w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all outline-none group-hover:border-gray-300 bg-gray-50 focus:bg-white"
              />
            </div>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="animate-fadeIn">
          <div className="mb-4">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Locations</h2>
            <p className="text-gray-600">Add your business locations</p>
          </div>
          <div className="space-y-6">
            {data.locations.map((loc, i) => (
              <div key={i} className="p-6 bg-gradient-to-br from-gray-50 to-blue-50/30 border-2 border-gray-200 rounded-xl space-y-4 hover:shadow-md transition-all">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-gray-700">Location {i + 1}</h3>
                  <div className="flex items-center gap-2">
                    {data.locations.length > 1 && (
                      <button
                        onClick={() => removeLocation(i)}
                        className="w-8 h-8 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center text-sm font-bold transition-colors group"
                        title="Remove location"
                      >
                        <svg className="w-4 h-4 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                    <div className="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold">
                      {i + 1}
                    </div>
                  </div>
                </div>
                <div className="md:flex md:gap-4">
                  <div className="group md:flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Location Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g., Downtown Branch"
                      value={loc.name}
                      onChange={(e) => updateLocation(i, 'name', e.target.value)}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all outline-none bg-white"
                    />
                  </div>
                  <div className="group md:flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Kitchen Close Time
                    </label>
                    <div className="relative">
                      <input
                        type="time"
                        value={loc.kitchenClose}
                        onChange={(e) => updateLocation(i, 'kitchenClose', e.target.value)}
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all outline-none bg-white"
                      />
                      <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="group">
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Address
                  </label>
                  <AddressAutocomplete
                    value={loc.address}
                    onChange={(address, lat, lng, timezone) => updateLocationAddress(i, address, lat, lng, timezone)}
                    placeholder="123 Main St, City, State"
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all outline-none bg-white"
                  />
                </div>
              </div>
            ))}
            <button
              onClick={addLocation}
              className="w-full py-4 border-2 border-dashed border-gray-300 rounded-xl text-gray-600 hover:border-blue-500 hover:text-blue-500 hover:bg-blue-50 transition-all font-medium flex items-center justify-center gap-2 group"
            >
              <svg className="w-5 h-5 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Location
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="animate-fadeIn">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Operators</h2>
            <p className="text-gray-600">Add team members who will operate each location</p>
            {data.locations.length > 0 && !allLocationsHaveOperators() && (
              <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex items-center gap-2 text-amber-800">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                  <span className="text-sm font-medium">Each location must have at least one operator to continue</span>
                </div>
              </div>
            )}
          </div>
          <div className="space-y-4">
            {data.locations.map((location, locationIndex) => {
              const isExpanded = expandedLocations.has(locationIndex)
              return (
                <div key={locationIndex} className="border-2 border-gray-200 rounded-xl overflow-hidden">
                  {/* Accordion Header */}
                  <div 
                    className="flex items-center justify-between p-4 bg-gradient-to-r from-indigo-50 to-purple-50 hover:from-indigo-100 hover:to-purple-100 cursor-pointer transition-all"
                    onClick={() => toggleLocationAccordion(locationIndex)}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-6 h-6 rounded-full transition-transform ${isExpanded ? 'rotate-90' : ''}`}>
                        <svg className="w-full h-full text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                      <h3 className="text-lg font-semibold text-gray-800">{location.name || `Location ${locationIndex + 1}`}</h3>
                      <div className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs font-medium">
                        {location.collaborators.length} operator{location.collaborators.length !== 1 ? 's' : ''}
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        addCollaborator(locationIndex)
                      }}
                      className="w-8 h-8 bg-indigo-500 hover:bg-indigo-600 text-white rounded-full flex items-center justify-center transition-colors group"
                      title="Add operator to this location"
                    >
                      <svg className="w-4 h-4 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    </button>
                  </div>

                  {/* Accordion Content */}
                  {isExpanded && (
                    <div className="p-6 bg-white space-y-4 border-t border-gray-200">
                      {location.collaborators.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                          <svg className="w-12 h-12 mx-auto mb-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                          </svg>
                          <p className="font-medium">No operators added yet</p>
                          <p className="text-sm">Click the + button above to add operators for this location</p>
                        </div>
                      ) : (
                        location.collaborators.map((col, colIndex) => (
                          <div key={colIndex} className="p-4 bg-gradient-to-br from-gray-50 to-indigo-50/30 border-2 border-gray-200 rounded-lg space-y-4">
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="font-semibold text-gray-700">Operator {colIndex + 1}</h4>
                              <div className="flex items-center gap-2">
                                {location.collaborators.length > 1 && (
                                  <button
                                    onClick={() => removeCollaborator(locationIndex, colIndex)}
                                    className="w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center text-sm font-bold transition-colors group"
                                    title="Remove operator"
                                  >
                                    <svg className="w-3 h-3 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                  </button>
                                )}
                                <div className="w-6 h-6 bg-indigo-500 text-white rounded-full flex items-center justify-center text-xs font-bold">
                                  {colIndex + 1}
                                </div>
                              </div>
                            </div>
                            
                            <div className="group">
                              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                Contact Type
                              </label>
                              <div className="relative">
                                <select
                                  value={col.contactType}
                                  onChange={(e) => updateCollaborator(locationIndex, colIndex, 'contactType', e.target.value as 'phone' | 'email')}
                                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 transition-all outline-none bg-white appearance-none cursor-pointer"
                                >
                                  <option value="phone">📱 Phone</option>
                                  <option value="email">📧 Email</option>
                                </select>
                                <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
                                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                  </svg>
                                </div>
                              </div>
                            </div>
                            
                            <div className="group">
                              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                {col.contactType === 'phone' ? 'WhatsApp Number' : 'Email Address'}
                              </label>
                              {col.contactType === 'phone' ? (
                                <div className="flex gap-2">
                                  <select
                                    value={col.countryCode || '+1'}
                                    onChange={(e) => updateCollaborator(locationIndex, colIndex, 'countryCode', e.target.value)}
                                    className="w-20 sm:w-28 px-2 sm:px-3 py-3 border-2 border-gray-200 rounded-lg focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 transition-all outline-none bg-white appearance-none cursor-pointer text-sm font-medium"
                                  >
                                    <option value="+1">🇺🇸 +1</option>
                                    <option value="+52">🇲🇽 +52</option>
                                    <option value="+44">🇬🇧 +44</option>
                                    <option value="+34">🇪🇸 +34</option>
                                    <option value="+33">🇫🇷 +33</option>
                                    <option value="+49">🇩🇪 +49</option>
                                    <option value="+39">🇮🇹 +39</option>
                                    <option value="+55">🇧🇷 +55</option>
                                    <option value="+54">🇦🇷 +54</option>
                                    <option value="+57">🇨🇴 +57</option>
                                    <option value="+56">🇨🇱 +56</option>
                                    <option value="+51">🇵🇪 +51</option>
                                    <option value="+58">🇻🇪 +58</option>
                                    <option value="+593">🇪🇨 +593</option>
                                    <option value="+506">🇨🇷 +506</option>
                                    <option value="+507">🇵🇦 +507</option>
                                  </select>
                                  <input
                                    type="tel"
                                    placeholder="555 000 0000"
                                    value={col.contactValue}
                                    onChange={(e) => {
                                      const value = e.target.value.replace(/[^\d\s]/g, '')
                                      updateCollaborator(locationIndex, colIndex, 'contactValue', value)
                                    }}
                                    className="flex-1 min-w-0 px-3 sm:px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 transition-all outline-none bg-white"
                                  />
                                </div>
                              ) : (
                                <input
                                  type="email"
                                  placeholder="operator@example.com"
                                  value={col.contactValue}
                                  onChange={(e) => updateCollaborator(locationIndex, colIndex, 'contactValue', e.target.value)}
                                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 transition-all outline-none bg-white"
                                />
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="animate-fadeIn">
          <div className="mb-4">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">POS Provider</h2>
            <p className="text-gray-600">Connect your point-of-sale system</p>
          </div>
          <div className="space-y-6">
            <div className="group">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Toast API Key
              </label>
              <div className="relative">
                <input
                  type="password"
                  placeholder="Enter your Toast API key"
                  value={data.apiKey}
                  onChange={(e) => setData(prev => ({ ...prev, apiKey: e.target.value }))}
                  className="w-full px-4 py-3.5 pr-12 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all outline-none group-hover:border-gray-300 bg-gray-50 focus:bg-white font-mono text-sm"
                />
                <div className="absolute inset-y-0 right-3 flex items-center">
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 p-4 bg-blue-50 border-2 border-blue-200 rounded-xl">
              <div className="flex-shrink-0">
                <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-sm text-blue-900 font-medium">Need an API key?</p>
                <button
                  onClick={() => window.open('https://toasttab.com', '_blank')}
                  className="text-sm text-blue-600 hover:text-blue-700 underline font-medium mt-1"
                >
                  Get your Toast API key here →
                </button>
              </div>
            </div>

            <div className="mt-6">
              <div className="flex items-center gap-2 mb-4">
                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm font-semibold text-gray-700">Quick Setup Guide</p>
              </div>
              <div className="aspect-video rounded-xl overflow-hidden shadow-lg border-2 border-gray-200">
                <iframe
                  className="w-full h-full"
                  src="https://www.youtube.com/embed/dQw4w9WgXcQ"
                  title="Toast API Key Setup Guide"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                ></iframe>
              </div>
            </div>
          </div>
        </div>
      )}

          {/* Navigation Buttons */}
          <div className="flex items-center justify-between mt-10 pt-6 border-t border-gray-200">
            <div className="hidden sm:block text-sm text-gray-500">
              Step {step} of {steps.length}
            </div>
            <div className="flex gap-3 w-full sm:w-auto justify-end">
              {step > 1 && (
                <button
                  onClick={() => setStep(step - 1)}
                  className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 hover:border-gray-400 transition-all flex items-center gap-2 group"
                >
                  <svg className="w-5 h-5 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Back
                </button>
              )}
              <button
                onClick={handleNext}
                disabled={step === 3 && !allLocationsHaveOperators()}
                className={`px-8 py-3 rounded-xl font-semibold transition-all shadow-lg flex items-center gap-2 group ${
                  step === 3 && !allLocationsHaveOperators() 
                    ? 'bg-gray-400 text-gray-200 cursor-not-allowed' 
                    : 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white hover:from-blue-600 hover:to-indigo-700 hover:shadow-xl transform hover:scale-105'
                }`}
              >
                {step === 4 ? (
                  <>
                    Complete
                    <svg className="w-5 h-5 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </>
                ) : (
                  <>
                    Continue
                    <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}