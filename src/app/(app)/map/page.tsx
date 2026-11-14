import dynamic from 'next/dynamic'

// Leaflet needs the browser, so the map is loaded on the client only.
const DiscoveryMap = dynamic(() => import('@/components/map/DiscoveryMap'), {
  ssr: false,
  loading: () => (
    <div className="flex h-[calc(100dvh-80px)] items-center justify-center">
      <div
        role="status"
        aria-label="Loading map"
        className="h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-[var(--accent)]"
      />
    </div>
  ),
})

export default function MapPage() {
  return <DiscoveryMap />
}
