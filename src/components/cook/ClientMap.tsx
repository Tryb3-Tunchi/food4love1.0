'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
  useMapEvents,
} from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useRouter } from 'next/navigation'
import { getCookLocations, getCookById } from '@/services/map'
import { useQuery } from '@tanstack/react-query'
import { LocateFixed, Star, X } from 'lucide-react'
import Image from 'next/image'

// Fix Leaflet default marker icons in Next.js
const markerIcon = new L.Icon({
  iconUrl: '/marker-icon.png',
  iconRetinaUrl: '/marker-icon-2x.png',
  shadowUrl: '/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
})

// Extend the type so className is accepted without TS errors
const activeMarkerIcon = new L.Icon({
  iconUrl: '/marker-icon.png',
  iconRetinaUrl: '/marker-icon-2x.png',
  shadowUrl: '/marker-shadow.png',
  iconSize: [30, 46],
  iconAnchor: [15, 46],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
  className: 'hue-rotate-[-30deg] saturate-150',
} as L.IconOptions & { className?: string })

function MapController({ center }: { center: [number, number] }) {
  const map = useMap()
  useEffect(() => {
    map.setView(center, 13)
  }, [center, map])
  return null
}

function ManualLocationPicker({
  onChoose,
}: {
  onChoose: (location: [number, number]) => void
}) {
  useMapEvents({
    click(event) {
      onChoose([event.latlng.lat, event.latlng.lng])
    },
  })
  return null
}

type DeviceLocation = { lat: number; lng: number }

const currentLocationIcon = L.divIcon({
  html: '<span class="f4l-current-location-dot" aria-hidden="true"></span>',
  className: 'f4l-current-location-marker',
  iconSize: [24, 24],
  iconAnchor: [12, 12],
})

export default function ClientMap() {
  const router = useRouter()
  const [selectedChefId, setSelectedChefId] = useState<string | null>(null)
  const [filterCuisine, setFilterCuisine] = useState<string>('all')
  const [trackingLocation, setTrackingLocation] = useState(false)
  const [deviceLocation, setDeviceLocation] = useState<DeviceLocation | null>(
    null,
  )
  const [manualLocation, setManualLocation] = useState<[number, number] | null>(
    null,
  )
  const [locationState, setLocationState] = useState<
    'idle' | 'loading' | 'active' | 'error'
  >('idle')
  const [locationMessage, setLocationMessage] = useState('')
  const [mapCenter, setMapCenter] = useState<[number, number] | null>(null)

  const { data: locations = [], isLoading } = useQuery({
    queryKey: ['cook-locations'],
    queryFn: getCookLocations,
  })

  const { data: selectedChef } = useQuery({
    queryKey: ['chef', selectedChefId],
    queryFn: () => getCookById(selectedChefId!),
    enabled: !!selectedChefId,
  })

  const cuisines = useMemo(() => {
    const set = new Set(locations.map((l) => l.cuisine))
    return ['all', ...Array.from(set)]
  }, [locations])

  const filtered = useMemo(() => {
    if (filterCuisine === 'all') return locations
    return locations.filter((l) => l.cuisine === filterCuisine)
  }, [locations, filterCuisine])

  const center: [number, number] = useMemo(() => {
    if (filtered.length === 0) return [6.5244, 3.3792] // Lagos default
    const avgLat = filtered.reduce((sum, l) => sum + l.lat, 0) / filtered.length
    const avgLng = filtered.reduce((sum, l) => sum + l.lng, 0) / filtered.length
    return [avgLat, avgLng]
  }, [filtered])

  const mapPosition = mapCenter ?? center

  useEffect(() => {
    if (!trackingLocation) return

    if (!navigator.geolocation) {
      setLocationState('error')
      setLocationMessage('Location is not supported by this browser.')
      setTrackingLocation(false)
      return
    }

    setLocationState('loading')
    setLocationMessage('Waiting for your device location…')
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const nextLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        }
        setDeviceLocation(nextLocation)
        setMapCenter(
          (previous) => previous ?? [nextLocation.lat, nextLocation.lng],
        )
        setLocationState('active')
        setLocationMessage('Your location is shown only on this device.')
      },
      (error) => {
        const message =
          error.code === error.PERMISSION_DENIED
            ? 'Location access was denied. Tap the map to choose an area manually.'
            : error.code === error.TIMEOUT
              ? 'Location is taking too long. You can choose an area by tapping the map.'
              : 'Your location is unavailable. Tap the map to choose an area manually.'
        setLocationState('error')
        setLocationMessage(message)
        setDeviceLocation(null)
        setMapCenter(null)
        setTrackingLocation(false)
      },
      { enableHighAccuracy: false, maximumAge: 30_000, timeout: 15_000 },
    )

    return () => navigator.geolocation.clearWatch(watchId)
  }, [trackingLocation])

  const toggleDeviceLocation = useCallback(() => {
    if (trackingLocation) {
      setTrackingLocation(false)
      setLocationState('idle')
      setDeviceLocation(null)
      setManualLocation(null)
      setMapCenter(null)
      setLocationMessage('Location tracking is off.')
      return
    }

    setLocationState('loading')
    setTrackingLocation(true)
  }, [trackingLocation])

  if (isLoading) {
    return (
      <div className="flex h-[calc(100dvh-80px)] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-[#E8390E]" />
      </div>
    )
  }

  return (
    <div className="relative h-[calc(100dvh-144px)] min-h-[420px] w-full overflow-hidden rounded-xl border border-[var(--border)] sm:h-[calc(100dvh-120px)]">
      <div className="absolute left-3 right-3 top-3 z-[400] flex items-start justify-between gap-2 sm:left-4 sm:right-4 sm:top-4">
        <div className="flex max-w-[65%] flex-wrap gap-2">
          {cuisines.map((cuisine) => (
            <button
              key={cuisine}
              type="button"
              onClick={() => setFilterCuisine(cuisine)}
              aria-pressed={filterCuisine === cuisine}
              className={`rounded-full border px-3 py-2 text-xs font-semibold shadow-sm backdrop-blur-md transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] sm:px-4 sm:text-sm ${
                filterCuisine === cuisine
                  ? 'border-[var(--accent)] bg-[var(--accent)] text-white'
                  : 'bg-[var(--card)]/95 border-[var(--border)] text-[var(--text-2)] hover:bg-[var(--bg-2)]'
              }`}
            >
              {cuisine === 'all' ? 'All cuisines' : cuisine}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={toggleDeviceLocation}
          disabled={locationState === 'loading'}
          className="bg-[var(--card)]/95 inline-flex shrink-0 items-center gap-2 rounded-xl border border-[var(--border)] px-3 py-2 text-xs font-semibold text-[var(--text-1)] shadow-sm backdrop-blur-md transition hover:bg-[var(--bg-2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:cursor-wait disabled:opacity-70 sm:text-sm"
          aria-label={
            trackingLocation
              ? 'Stop using my location'
              : 'Use my current location'
          }
        >
          <LocateFixed className="h-4 w-4 text-[var(--accent)]" />
          <span className="hidden sm:inline">
            {locationState === 'loading'
              ? 'Locating…'
              : trackingLocation
                ? 'Stop location'
                : 'Use my location'}
          </span>
        </button>
      </div>

      {(locationMessage || locationState === 'idle') && (
        <p
          role={locationState === 'error' ? 'alert' : 'status'}
          className={`absolute left-3 right-3 top-[4.25rem] z-[400] rounded-lg px-3 py-2 text-xs shadow-sm sm:left-4 sm:right-auto sm:top-16 sm:max-w-sm ${
            locationState === 'error'
              ? 'bg-[var(--card)] text-[var(--danger)]'
              : 'bg-[var(--card)]/95 text-[var(--text-2)]'
          }`}
        >
          {locationMessage ||
            'Center the map near you. Your location stays on this device.'}
        </p>
      )}

      {/* Filter bar */}
      <MapContainer
        center={mapPosition}
        zoom={13}
        scrollWheelZoom={false}
        className="h-full w-full"
      >
        <MapController center={mapPosition} />
        <ManualLocationPicker
          onChoose={(location) => {
            setTrackingLocation(false)
            setDeviceLocation(null)
            setManualLocation(location)
            setMapCenter(location)
            setLocationState('idle')
            setLocationMessage(
              'Browsing from your selected map point. This stays on your device.',
            )
          }}
        />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {filtered.map((loc) => (
          <Marker
            key={loc.id}
            position={[loc.lat, loc.lng]}
            icon={selectedChefId === loc.id ? activeMarkerIcon : markerIcon}
            eventHandlers={{
              click: () => {
                setSelectedChefId(loc.id)
              },
            }}
          >
            <Popup>
              <div className="flex flex-col">
                <h3 className="text-sm font-semibold">{loc.name}</h3>
                <p className="text-xs text-gray-500">{loc.cuisine}</p>
              </div>
            </Popup>
          </Marker>
        ))}
        {deviceLocation && (
          <Marker
            position={[deviceLocation.lat, deviceLocation.lng]}
            icon={currentLocationIcon}
            keyboard={false}
          >
            <Popup>You are here. This location stays on your device.</Popup>
          </Marker>
        )}
        {manualLocation && (
          <Marker
            position={manualLocation}
            icon={currentLocationIcon}
            keyboard={false}
          >
            <Popup>
              Selected browsing point. This location stays on your device.
            </Popup>
          </Marker>
        )}
      </MapContainer>

      {!isLoading && filtered.length === 0 && (
        <div className="pointer-events-none absolute inset-x-4 bottom-4 z-[400] flex justify-center">
          <p className="bg-[var(--card)]/95 rounded-xl border border-[var(--border)] px-4 py-3 text-center text-sm text-[var(--text-2)] shadow-sm">
            No verified cooks with map locations are available in this cuisine
            yet.
          </p>
        </div>
      )}

      <style jsx global>{`
        .f4l-current-location-marker {
          border: 0;
          background: transparent;
        }
        .f4l-current-location-dot {
          display: block;
          width: 18px;
          height: 18px;
          border: 3px solid #fff;
          border-radius: 50%;
          background: #3478f6;
          box-shadow: 0 0 0 7px rgba(52, 120, 246, 0.2);
        }
      `}</style>

      {/* Selected Chef Card */}
      {selectedChef && (
        <div className="absolute bottom-4 left-4 right-4 z-[400] rounded-2xl bg-white p-4 shadow-lg">
          <button
            type="button"
            onClick={() => setSelectedChefId(null)}
            className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
          >
            <X size={18} />
          </button>
          <div className="flex items-center gap-3">
            <Image
              src={selectedChef.avatar_url || '/placeholder.png'}
              alt={selectedChef.full_name}
              width={64}
              height={64}
              className="rounded-xl object-cover"
            />
            <div>
              <h3 className="text-lg font-bold">{selectedChef.full_name}</h3>
              <p className="text-sm text-gray-500">
                {selectedChef.cuisines?.join(', ')}
              </p>
              <div className="mt-1 flex items-center gap-1">
                <Star size={14} className="text-yellow-500" />
                <span className="text-sm font-medium">
                  {selectedChef.rating?.toFixed(1) || 'N/A'} (
                  {selectedChef.review_count || 0})
                </span>
              </div>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => router.push('/cook/' + selectedChef.id)}
              className="flex-1 rounded-xl bg-[#E8390E] py-2 text-white"
            >
              View Profile
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
