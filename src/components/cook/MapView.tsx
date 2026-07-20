'use client'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'

// Fix leaflet default icon in Next.js
const icon = L.divIcon({
  html: `<div class="flex h-8 w-8 items-center justify-center rounded-full bg-pepper shadow-glow text-white text-sm">🍳</div>`,
  className: '',
  iconSize: [32, 32],
  iconAnchor: [16, 32],
})

const mockLocations = [
  {
    id: '1',
    name: 'Adaeze O.',
    lat: 6.4281,
    lng: 3.4219,
    cuisine: 'Igbo Cuisine',
  },
  {
    id: '2',
    name: 'Emeka T.',
    lat: 6.4355,
    lng: 3.4173,
    cuisine: 'Nigerian BBQ',
  },
  {
    id: '3',
    name: 'Fatima B.',
    lat: 6.4418,
    lng: 3.4291,
    cuisine: 'Hausa Cuisine',
  },
]

export default function MapView() {
  return (
    <MapContainer
      center={[6.4281, 3.4219]}
      zoom={13}
      className="h-full w-full"
      style={{ background: '#0F0A05' }}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        attribution="© OpenStreetMap contributors © CARTO"
      />
      {mockLocations.map((loc) => (
        <Marker key={loc.id} position={[loc.lat, loc.lng]} icon={icon}>
          <Popup>
            <div className="text-sm font-semibold">{loc.name}</div>
            <div className="text-xs text-gray-500">{loc.cuisine}</div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  )
}
