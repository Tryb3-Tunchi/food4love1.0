'use client'

import { useEffect, useMemo, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useRouter } from 'next/navigation'
import { getCookLocations, getCookById } from '@/services/map'
import { useQuery } from '@tanstack/react-query'
import { Star, X } from 'lucide-react'
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

export default function ClientMap() {
  const router = useRouter()
  const [selectedChefId, setSelectedChefId] = useState<string | null>(null)
  const [filterCuisine, setFilterCuisine] = useState<string>('all')

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

  if (isLoading) {
    return (
      <div className="flex h-[calc(100dvh-80px)] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-[#E8390E]" />
      </div>
    )
  }

  return (
    <div className="relative h-[calc(100dvh-80px)] w-full">
      {/* Filter bar */}
      <div className="absolute left-4 right-4 top-4 z-[400] flex gap-2 overflow-x-auto pb-2">
        {cuisines.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setFilterCuisine(c)}
            className="shrink-0 rounded-full px-4 py-2 text-sm font-medium backdrop-blur-md transition-colors"
          >
            {c === 'all' ? 'All Cuisines' : c}
          </button>
        ))}
      </div>

      <MapContainer
        center={center}
        zoom={13}
        scrollWheelZoom={false}
        className="h-full w-full"
      >
        <MapController center={center} />
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
                <h3 className="text-sm font-semibold">{loc.full_name}</h3>
                <p className="text-xs text-gray-500">{loc.location}</p>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

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
