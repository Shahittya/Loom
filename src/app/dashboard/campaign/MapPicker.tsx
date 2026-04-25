'use client'
import { useEffect, useRef } from 'react'

interface MapPickerProps {
  location: { lat: number; lng: number }
  radius: number // km
  onLocationChange: (loc: { lat: number; lng: number }) => void
}

export default function MapPicker({ location, radius, onLocationChange }: MapPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markerRef = useRef<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const circleRef = useRef<any>(null)

  // Initialise map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    // Inject Leaflet CSS into <head> once
    const LEAFLET_CSS = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css'
    if (!document.querySelector(`link[href="${LEAFLET_CSS}"]`)) {
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = LEAFLET_CSS
      document.head.appendChild(link)
    }

    import('leaflet')
      .then(L => {
        if (!containerRef.current) return
        // Fix default icon paths
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        delete (L.Icon.Default.prototype as any)._getIconUrl
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
          iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
          shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
        })

        const map = L.map(containerRef.current).setView([location.lat, location.lng], 12)
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        }).addTo(map)

        markerRef.current = L.marker([location.lat, location.lng]).addTo(map)
        circleRef.current = L.circle([location.lat, location.lng], {
          radius: radius * 1000,
          color: '#3b82f6',
          fillColor: '#93c5fd',
          fillOpacity: 0.25,
          weight: 2,
          dashArray: '6 4',
        }).addTo(map)

        map.on('click', (e: { latlng: { lat: number; lng: number } }) => {
          onLocationChange({ lat: e.latlng.lat, lng: e.latlng.lng })
        })

        mapRef.current = map
      })
      .catch(() => { /* Leaflet failed to load — map stays blank, no crash */ })

    return () => {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Update marker + circle when location/radius change
  useEffect(() => {
    if (!mapRef.current || !markerRef.current || !circleRef.current) return
    markerRef.current.setLatLng([location.lat, location.lng])
    circleRef.current.setLatLng([location.lat, location.lng])
    circleRef.current.setRadius(radius * 1000)
    mapRef.current.setView([location.lat, location.lng], mapRef.current.getZoom())
  }, [location.lat, location.lng, radius])

  return (
    <div
      ref={containerRef}
      style={{ height: '300px', width: '100%', borderRadius: '12px', zIndex: 0 }}
    />
  )
}
