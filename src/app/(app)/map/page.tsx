'use client'

import { useEffect, useMemo, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useRouter } from 'next/navigation'
import { getCookLocations, getCookById, MapLocation } from '@/services/map'
import { useQuery } from '@tanstack/react-query'
import { ChefHat, Star, MapPin, X } from 'lucide-react'

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

const activeMarkerIcon = new L.Icon({
  iconUrl: '/marker-icon.png',
  iconRetinaUrl: '/marker-icon-2x.png',
  shadowUrl: '/marker-shadow.png',
  iconSize: [30, 46],
  iconAnchor: [15, 46],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
  className: 'hue-rotate-[-30deg] saturate-150',
})

function MapController({ center }: { center: [number, number] }) {
  const map = useMap()
  useEffect(() => {
    map.setView(center, 13)
  }, [center, map])
  return null
}

export default function MapPage() {
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
            onClick={() => setFilterCuisine(c)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium backdrop-blur-md transition-colors ${
              filterCuisine === c
                ? 'bg-[#E8390E] text-white'
                : 'bg-[#1A1008]/80 text-white/70 hover:bg-[#1A1008]'
            }`}
          >
            {c === 'all' ? 'All Cuisines' : c}
          </button>
        ))}
      </div>

      {/* Chef count */}
      <div className="absolute bottom-6 left-4 z-[400] rounded-full bg-[#1A1008]/90 px-4 py-2 text-sm text-white/80 backdrop-blur-md">
        <ChefHat className="mr-2 inline h-4 w-4 text-[#E8390E]" />
        {filtered.length} chef{filtered.length !== 1 ? 's' : ''} nearby
      </div>

      {/* Selected chef detail panel */}
      {selectedChef && (
        <div className="absolute bottom-6 right-4 z-[400] w-72 rounded-2xl border border-white/10 bg-[#1A1008]/95 p-4 backdrop-blur-md">
          <button
            onClick={() => setSelectedChefId(null)}
            className="absolute right-3 top-3 rounded-full p-1 text-white/40 hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-white/10">
              {selectedChef.avatar_url ? (
                <img
                  src={selectedChef.avatar_url}
                  alt={selectedChef.full_name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="text-xl">🧑‍🍳</span>
              )}
            </div>
            <div className="min-w-0">
              <h3 className="truncate font-semibold text-white">
                {selectedChef.full_name}
              </h3>
              <div className="flex items-center gap-1 text-sm text-white/60">
                <MapPin className="h-3 w-3" />
                <span className="truncate">
                  {selectedChef.location ?? 'Lagos'}
                </span>
              </div>
            </div>
          </div>
          {selectedChef.bio && (
            <p className="mt-2 line-clamp-2 text-sm text-white/60">
              {selectedChef.bio}
            </p>
          )}
          <div className="mt-3 flex items-center justify-between">
            <div className="flex items-center gap-1 text-sm">
              <Star className="h-4 w-4 fill-[#F59E0B] text-[#F59E0B]" />
              <span className="text-white">{selectedChef.rating ?? '—'}</span>
              <span className="text-white/40">
                ({selectedChef.review_count ?? 0})
              </span>
            </div>
            <span className="text-sm font-semibold text-[#E8390E]">
              ₦{(selectedChef.price_min ?? 0).toLocaleString()}+
            </span>
          </div>
          <button
            onClick={() => router.push(`/cook/${selectedChef.id}`)}
            className="mt-3 w-full rounded-xl bg-[#E8390E] py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#d1300d]"
          >
            View Profile
          </button>
        </div>
      )}

      <MapContainer
        center={center}
        zoom={13}
        className="h-full w-full"
        zoomControl={false}
      >
        <MapController center={center} />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {filtered.map((loc) => (
          <Marker
            key={loc.id}
            position={[loc.lat, loc.lng]}
            icon={selectedChefId === loc.id ? activeMarkerIcon : markerIcon}
            eventHandlers={{
              click: () => setSelectedChefId(loc.id),
            }}
          >
            <Popup className="custom-popup">
              <div className="min-w-[160px]">
                <p className="font-semibold text-[#0F0A05]">{loc.name}</p>
                <p className="text-sm text-[#0F0A05]/60">{loc.cuisine}</p>
                <p className="mt-1 text-sm font-semibold text-[#E8390E]">
                  ₦{loc.price.toLocaleString()}+
                </p>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  )
}
