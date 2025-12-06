'use client'

import { useEffect, useRef, useState } from 'react'

interface AddressAutocompleteProps {
  value: string
  onChange: (address: string, lat?: number, lng?: number) => void
  placeholder?: string
  className?: string
}

declare global {
  interface Window {
    google: any
  }
}

export default function AddressAutocomplete({
  value,
  onChange,
  placeholder = "Enter address",
  className = ""
}: AddressAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [autocomplete, setAutocomplete] = useState<any>(null)
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

    if (!apiKey) {
      console.warn('Google Maps API key not found')
      return
    }

    // Load Google Maps API script if not already loaded
    if (!window.google) {
      const script = document.createElement('script')
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`
      script.async = true
      script.defer = true
      script.onload = () => setIsLoaded(true)
      script.onerror = () => console.error('Failed to load Google Maps API')
      document.head.appendChild(script)
    } else {
      setIsLoaded(true)
    }
  }, [])

  useEffect(() => {
    if (!isLoaded || !inputRef.current || !window.google) return

    const autocompleteInstance = new window.google.maps.places.Autocomplete(inputRef.current, {
      types: ['address'],
      fields: ['formatted_address', 'geometry']
    })

    autocompleteInstance.addListener('place_changed', () => {
      const place = autocompleteInstance.getPlace()

      if (place.formatted_address && place.geometry?.location) {
        const lat = place.geometry.location.lat()
        const lng = place.geometry.location.lng()
        onChange(place.formatted_address, lat, lng)
      }
    })

    setAutocomplete(autocompleteInstance)

    return () => {
      if (autocompleteInstance && window.google) {
        window.google.maps.event.clearInstanceListeners(autocompleteInstance)
      }
    }
  }, [isLoaded, onChange])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Only update the address text, keep existing lat/lng if any
    onChange(e.target.value)
  }

  return (
    <input
      ref={inputRef}
      type="text"
      value={value}
      onChange={handleInputChange}
      placeholder={placeholder}
      className={className}
      autoComplete="off"
    />
  )
}