'use client'
import dynamic from 'next/dynamic'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, X, Star, MapPin, BadgeCheck } from 'lucide-react'
import { MOCK_CHEFS, MOCK_MAP_LOCATIONS } from '@/lib/mockData'
import { formatNaira } from '@/lib/utils'
import { useRouter } from 'next/navigation'

const MapContainer = dynamic(
  () => import('react-leaflet').then((m) => m.MapContainer),
  { ssr: false },
)
const TileLayer = dynamic(
  () => import('react-leaflet').then((m) => m.TileLayer),
  { ssr: false },
)
const Marker = dynamic(() => import('react-leaflet').then((m) => m.Marker), {
  ssr: false,
})
const Popup = dynamic(() => import('react-leaflet').then((m) => m.Popup), {
  ssr: false,
})

function ChefMapCard({
  chefId,
  onClose,
}: {
  chefId: string
  onClose: () => void
}) {
  const router = useRouter()
  const chef = MOCK_CHEFS.find((c) => c.id === chefId)
  if (!chef) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="absolute bottom-24 left-4 right-4 z-[1000] overflow-hidden rounded-3xl shadow-xl"
      style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
    >
      <div className="p-4">
        <button
          onClick={onClose}
          className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full"
          style={{ background: 'var(--bg-2)' }}
        >
          <X className="h-3.5 w-3.5" style={{ color: 'var(--text-3)' }} />
        </button>

        <div className="flex items-start gap-3">
          <div
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-4xl"
            style={{ background: 'var(--bg-2)' }}
          >
            {chef.emoji}
          </div>
          <div className="min-w-0 flex-1 pr-6">
            <div className="mb-0.5 flex items-center gap-1.5">
              <h3
                className="truncate font-heading text-base font-bold"
                style={{ color: 'var(--text-1)' }}
              >
                {chef.full_name}
              </h3>
              {chef.is_verified && (
                <BadgeCheck
                  className="h-4 w-4 shrink-0"
                  style={{ color: 'var(--success)' }}
                />
              )}
            </div>
            <p
              className="mb-1 text-xs font-medium"
              style={{ color: 'var(--accent)' }}
            >
              {chef.tagline}
            </p>
            <div className="flex items-center gap-3">
              <span
                className="flex items-center gap-0.5 text-xs font-semibold"
                style={{ color: 'var(--text-2)' }}
              >
                <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                {chef.rating}
              </span>
              <span
                className="flex items-center gap-0.5 text-xs"
                style={{ color: 'var(--text-3)' }}
              >
                <MapPin className="h-3 w-3" />
                {chef.location}
              </span>
            </div>
          </div>
        </div>

        {chef.daily_special && (
          <div
            className="mt-3 flex items-center justify-between rounded-xl p-3"
            style={{
              background: 'rgba(232,116,40,0.08)',
              border: '1px solid rgba(232,116,40,0.15)',
            }}
          >
            <div className="min-w-0 flex-1">
              <p
                className="mb-0.5 text-xs font-bold"
                style={{ color: 'var(--accent)' }}
              >
                🍽 Today's Special
              </p>
              <p
                className="truncate text-xs"
                style={{ color: 'var(--text-2)' }}
              >
                {chef.daily_special.title}
              </p>
            </div>
            <span
              className="ml-3 shrink-0 text-sm font-bold"
              style={{ color: 'var(--accent)' }}
            >
              {formatNaira(chef.daily_special.price)}
            </span>
          </div>
        )}

        <div className="mt-3 flex gap-2">
          <button
            onClick={() => router.push('/swipe')}
            className="flex-1 rounded-2xl py-3 text-sm font-bold text-white transition-all active:scale-95"
            style={{
              background: 'var(--accent)',
              boxShadow: '0 4px 16px rgba(232,116,40,0.3)',
            }}
          >
            Like Chef ❤️
          </button>
          <button
            onClick={() => router.push('/chat')}
            className="flex-1 rounded-2xl py-3 text-sm font-bold transition-all active:scale-95"
            style={{
              background: 'var(--bg-2)',
              border: '1px solid var(--border)',
              color: 'var(--text-1)',
            }}
          >
            Message
          </button>
        </div>
      </div>
    </motion.div>
  )
}

export default function MapPage() {
  const [selected, setSelected] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [mapLoaded, setMapLoaded] = useState(false)

  const filtered = MOCK_MAP_LOCATIONS.filter(
    (l) =>
      search === '' ||
      l.name.toLowerCase().includes(search.toLowerCase()) ||
      l.cuisine.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <div
      className="relative h-[100dvh] overflow-hidden"
      style={{ background: 'var(--bg)' }}
    >
      {/* Search bar — floating above map */}
      <div className="absolute left-4 right-4 top-4 z-[1000]">
        <div
          className="flex items-center gap-2 rounded-2xl px-4 py-3 shadow-lift"
          style={{
            background: 'var(--card)',
            border: '1px solid var(--border)',
          }}
        >
          <Search
            className="h-4 w-4 shrink-0"
            style={{ color: 'var(--text-3)' }}
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search chefs or cuisine..."
            className="flex-1 bg-transparent text-sm outline-none"
            style={{ color: 'var(--text-1)' }}
          />
          {search && (
            <button onClick={() => setSearch('')}>
              <X className="h-4 w-4" style={{ color: 'var(--text-3)' }} />
            </button>
          )}
        </div>

        {/* Filter chips */}
        <div className="scrollbar-none mt-2 flex gap-2 overflow-x-auto pb-1">
          {['All', 'Verified', 'Daily Special', '< ₦10k'].map((chip) => (
            <button
              key={chip}
              className="shrink-0 rounded-full px-3 py-1.5 text-xs font-bold transition-all"
              style={{
                background: chip === 'All' ? 'var(--accent)' : 'var(--card)',
                color: chip === 'All' ? 'white' : 'var(--text-2)',
                border: `1px solid ${chip === 'All' ? 'var(--accent)' : 'var(--border)'}`,
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
              }}
            >
              {chip}
            </button>
          ))}
        </div>
      </div>

      {/* Map */}
      <div className="absolute inset-0">
        <MapContainer
          center={[6.5244, 3.3792]}
          zoom={12}
          className="h-full w-full"
          style={{ background: '#FFF5E8' }}
          zoomControl={false}
          whenReady={() => setMapLoaded(true)}
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
            attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          />
          {filtered.map((loc) => {
            if (typeof window === 'undefined') return null
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const L = require('leaflet')
            const icon = L.divIcon({
              html: `<div style="
                width:44px;height:44px;border-radius:50%;
                background:${selected === loc.id ? '#E87428' : '#FFFFFF'};
                border:3px solid ${selected === loc.id ? '#D9651C' : '#E8DED5'};
                display:flex;align-items:center;justify-content:center;
                font-size:22px;cursor:pointer;
                box-shadow:0 4px 16px rgba(232,116,40,${selected === loc.id ? '0.4' : '0.15'});
                transition:all 0.2s ease;
              ">${loc.emoji}</div>`,
              className: '',
              iconSize: [44, 44],
              iconAnchor: [22, 22],
            })

            return (
              <Marker
                key={loc.id}
                position={[loc.lat, loc.lng]}
                icon={icon}
                eventHandlers={{
                  click: () => setSelected(loc.id === selected ? null : loc.id),
                }}
              >
                <Popup
                  className="f4l-map-popup"
                  closeButton={false}
                  offset={[0, -22]}
                >
                  <div
                    style={{
                      fontFamily: "'Plus Jakarta Sans Variable', sans-serif",
                      padding: '4px 2px',
                    }}
                  >
                    <p
                      style={{
                        fontWeight: 700,
                        fontSize: 13,
                        color: '#2F241F',
                        marginBottom: 2,
                      }}
                    >
                      {loc.name}
                    </p>
                    <p style={{ fontSize: 11, color: '#9A8E86' }}>
                      {loc.cuisine}
                    </p>
                    <p
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: '#E87428',
                        marginTop: 4,
                      }}
                    >
                      {formatNaira(loc.price)}+
                    </p>
                  </div>
                </Popup>
              </Marker>
            )
          })}
        </MapContainer>
      </div>

      {/* Chef card on select */}
      <AnimatePresence>
        {selected && (
          <ChefMapCard chefId={selected} onClose={() => setSelected(null)} />
        )}
      </AnimatePresence>

      {/* Chef count pill */}
      <div
        className="absolute bottom-24 right-4 z-[1000] rounded-full px-3 py-2 shadow-lift"
        style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
      >
        <p className="text-xs font-bold" style={{ color: 'var(--text-2)' }}>
          {filtered.length} chefs nearby
        </p>
      </div>
    </div>
  )
}
