'use client'

import { useEffect, useRef, useState } from 'react'

interface AddressAutocompleteProps {
  value: string
  onChange: (address: string, lat?: number, lng?: number, timezone?: string) => void
  placeholder?: string
  className?: string
}

declare global {
  interface Window {
    google: any
    googleMapsLoading?: Promise<void>
    googleMapsLoaded?: boolean
  }
}

// Function to get timezone from coordinates using Google Maps Timezone API
const getTimezoneFromCoordinates = async (lat: number, lng: number, apiKey: string): Promise<string> => {
  try {
    // Use current timestamp for timezone calculation
    const timestamp = Math.floor(Date.now() / 1000)
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/timezone/json?location=${lat},${lng}&timestamp=${timestamp}&key=${apiKey}`
    )
    
    if (!response.ok) {
      throw new Error('Timezone API request failed')
    }
    
    const data = await response.json()
    
    if (data.status === 'OK' && data.timeZoneId) {
      console.log('🌍 Timezone detected:', data.timeZoneId)
      return data.timeZoneId
    } else {
      console.warn('Timezone API error:', data.status, data.errorMessage)
      // Fallback to Colombia timezone for addresses in Colombia
      return 'America/Bogota'
    }
  } catch (error) {
    console.error('Error fetching timezone:', error)
    // Fallback to Colombia timezone
    return 'America/Bogota'
  }
}

// Global function to load Google Maps script (singleton pattern)
const loadGoogleMapsScript = (apiKey: string): Promise<void> => {
  // If already loaded, return resolved promise
  if (window.googleMapsLoaded || window.google?.maps) {
    return Promise.resolve()
  }

  // If loading is in progress, return existing promise
  if (window.googleMapsLoading) {
    return window.googleMapsLoading
  }

  // Create new loading promise
  window.googleMapsLoading = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=initGoogleMaps`
    script.async = true
    script.defer = true
    
    // Global callback for when script loads
    ;(window as any).initGoogleMaps = () => {
      window.googleMapsLoaded = true
      delete window.googleMapsLoading
      delete (window as any).initGoogleMaps
      resolve()
    }
    
    script.onerror = () => {
      delete window.googleMapsLoading
      reject(new Error('Failed to load Google Maps API'))
    }
    
    document.head.appendChild(script)
  })

  return window.googleMapsLoading
}

export default function AddressAutocomplete({
  value,
  onChange,
  placeholder = "Enter address or business name",
  className = ""
}: AddressAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [autocomplete, setAutocomplete] = useState<any>(null)
  const [isLoaded, setIsLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastCoordinates, setLastCoordinates] = useState<{lat?: number, lng?: number}>({})  
  const [isSelectingFromDropdown, setIsSelectingFromDropdown] = useState(false)
  const [searchType, setSearchType] = useState<'establishment' | 'geocode'>('establishment')

  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

    if (!apiKey) {
      console.warn('Google Maps API key not found')
      setError('Google Maps API key not configured')
      return
    }

    let isMounted = true

    // Load Google Maps script using singleton pattern
    loadGoogleMapsScript(apiKey)
      .then(() => {
        if (isMounted) {
          setIsLoaded(true)
          setError(null)
        }
      })
      .catch((err) => {
        if (isMounted) {
          console.error('Failed to load Google Maps API:', err)
          setError('Failed to load Google Maps')
        }
      })

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    if (!isLoaded || !inputRef.current || !window.google?.maps?.places) {
      console.log('AddressAutocomplete: Not ready yet...', { 
        isLoaded, 
        hasInputRef: !!inputRef.current, 
        hasGoogleMaps: !!window.google?.maps?.places 
      })
      return
    }

    console.log('AddressAutocomplete: Initializing autocomplete with type:', searchType)
    let autocompleteInstance: any = null

    try {
      // Configure autocomplete based on search type
      const config: any = {
        types: [searchType], // Use single type to avoid mixing restrictions
        fields: ['formatted_address', 'geometry', 'name', 'place_id', 'types'],
        // Removed country restriction to allow international locations
        strictBounds: false
      }

      autocompleteInstance = new window.google.maps.places.Autocomplete(inputRef.current, config)

      console.log('AddressAutocomplete: Autocomplete instance created:', autocompleteInstance)

      const handlePlaceChanged = () => {
        console.log('🏠 AddressAutocomplete: handlePlaceChanged triggered!')
        setIsSelectingFromDropdown(true)
        try {
          const place = autocompleteInstance.getPlace()
          console.log('🏠 AddressAutocomplete: place data:', place)

          if ((place.formatted_address || place.name) && place.geometry?.location) {
            const lat = place.geometry.location.lat()
            const lng = place.geometry.location.lng()
            
            // Use formatted_address if available, otherwise use name (for establishments)
            const address = place.formatted_address || place.name || ''
            
            console.log('🏠 AddressAutocomplete: Location extracted:', { 
              address,
              name: place.name,
              formatted_address: place.formatted_address,
              lat, 
              lng 
            })
            
            // Get timezone for the coordinates
            const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
            if (apiKey) {
              getTimezoneFromCoordinates(lat, lng, apiKey)
                .then((timezone) => {
                  console.log('🌍 AddressAutocomplete: Timezone obtained:', timezone)
                  setLastCoordinates({ lat, lng })
                  onChange(address, lat, lng, timezone)
                })
                .catch((error) => {
                  console.error('🌍 AddressAutocomplete: Error getting timezone:', error)
                  // Still call onChange but without timezone
                  setLastCoordinates({ lat, lng })
                  onChange(address, lat, lng, 'America/Bogota') // Default fallback
                })
            } else {
              setLastCoordinates({ lat, lng })
              onChange(address, lat, lng, 'America/Bogota')
            }
          } else {
            console.log('🏠 AddressAutocomplete: Place data incomplete:', { 
              hasAddress: !!place.formatted_address,
              hasName: !!place.name,
              hasGeometry: !!place.geometry?.location
            })
            // Still call onChange but with undefined coordinates
            const fallbackAddress = place.formatted_address || place.name || inputRef.current?.value || ''
            onChange(fallbackAddress)
          }
        } catch (err) {
          console.error('🏠 AddressAutocomplete: Error in place_changed handler:', err)
        }
        
        // Reset flag after a short delay
        setTimeout(() => setIsSelectingFromDropdown(false), 100)
      }

      autocompleteInstance.addListener('place_changed', handlePlaceChanged)
      console.log('AddressAutocomplete: Event listener added')
      setAutocomplete(autocompleteInstance)
    } catch (err) {
      console.error('Error creating autocomplete instance:', err)
      setError('Error initializing address autocomplete')
    }

    return () => {
      if (autocompleteInstance && window.google?.maps?.event) {
        try {
          window.google.maps.event.clearInstanceListeners(autocompleteInstance)
        } catch (err) {
          console.error('Error clearing autocomplete listeners:', err)
        }
      }
      setAutocomplete(null)
    }
  }, [isLoaded, searchType])  // Include searchType in dependencies

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    console.log('AddressAutocomplete: Manual input change:', newValue)
    
    // Only call onChange for manual typing, not dropdown selections
    if (!isSelectingFromDropdown) {
      onChange(newValue)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Allow navigation in autocomplete dropdown
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      console.log('AddressAutocomplete: Navigation key pressed:', e.key)
      setIsSelectingFromDropdown(true)
    } else if (e.key === 'Enter') {
      console.log('AddressAutocomplete: Enter pressed')
      // Enter might be selecting from dropdown
      setIsSelectingFromDropdown(true)
      setTimeout(() => setIsSelectingFromDropdown(false), 200)
    }
  }

  const handleFocus = () => {
    console.log('AddressAutocomplete: Input focused')
  }

  const handleBlur = () => {
    console.log('AddressAutocomplete: Input blurred')
    setTimeout(() => setIsSelectingFromDropdown(false), 100)
  }

  if (error) {
    return (
      <div className="space-y-2">
        <div className="flex gap-2 mb-2">
          <button
            type="button"
            onClick={() => setSearchType('establishment')}
            className={`px-3 py-1 text-xs rounded-md transition-colors ${
              searchType === 'establishment'
                ? 'bg-blue-100 text-blue-700 border border-blue-300'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            🏪 Business
          </button>
          <button
            type="button"
            onClick={() => setSearchType('geocode')}
            className={`px-3 py-1 text-xs rounded-md transition-colors ${
              searchType === 'geocode'
                ? 'bg-blue-100 text-blue-700 border border-blue-300'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            🏠 Address
          </button>
        </div>
        <input
          type="text"
          value={value}
          onChange={handleInputChange}
          placeholder={placeholder}
          className={className}
          autoComplete="off"
          title={error}
        />
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2 mb-2">
        <button
          type="button"
          onClick={() => setSearchType('establishment')}
          className={`px-3 py-1 text-xs rounded-md transition-colors ${
            searchType === 'establishment'
              ? 'bg-blue-100 text-blue-700 border border-blue-300'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          🏪 Business
        </button>
        <button
          type="button"
          onClick={() => setSearchType('geocode')}
          className={`px-3 py-1 text-xs rounded-md transition-colors ${
            searchType === 'geocode'
              ? 'bg-blue-100 text-blue-700 border border-blue-300'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          🏠 Address
        </button>
      </div>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder={placeholder}
        className={className}
        autoComplete="off"
      />
    </div>
  )
}