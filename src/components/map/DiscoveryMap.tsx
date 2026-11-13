'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  MapContainer,
  Marker,
  TileLayer,
  useMap,
  useMapEvents,
} from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import Link from 'next/link'
import {
  BadgeCheck,
  EyeOff,
  LocateFixed,
  MapPin,
  RefreshCw,
  Star,
  X,
} from 'lucide-react'
import {
  DISCOVERY_PAGE_SIZE,
  DiscoveryUnavailableError,
  fetchDiscoveryPage,
  getMyDiscovery,
  type DiscoveryProfile,
} from '@/services/discovery'
import {
  clampBounds,
  clusterProfiles,
  mergeProfiles,
  type Bounds,
  type Cluster,
} from '@/lib/discovery/geo'
import { profileHref } from '@/lib/profileLinks'
import { DISCOVERY_AREAS as AREAS } from '@/lib/discovery/areas'

type RoleFilter = 'all' | 'cook' | 'buyer'
const ROLE_FILTERS: { id: RoleFilter; label: string }[] = [
  { id: 'all', label: 'Everyone' },
  { id: 'cook', label: 'Home chefs' },
  { id: 'buyer', label: 'Food lovers' },
]

const RING: Record<string, string> = {
  cook: '#E8390E',
  buyer: '#2F7D6D',
}

function initials(name: string | null) {
  return (name ?? '?')
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

// Built with DOM nodes (not an HTML string) so a member's name or photo address can
// never inject markup into the page.
function avatarIcon(profile: DiscoveryProfile, selected: boolean) {
  const el = document.createElement('div')
  const size = selected ? 52 : 44
  el.style.cssText = `width:${size}px;height:${size}px;border-radius:9999px;border:3px solid ${
    RING[profile.role] ?? '#888'
  };background:#fff;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center;font:700 14px system-ui,sans-serif;color:#444`
  const url = profile.avatar_url ?? ''
  if (/^https?:\/\//i.test(url)) {
    const img = document.createElement('img')
    img.src = url
    img.alt = ''
    img.loading = 'lazy'
    img.style.cssText = 'width:100%;height:100%;object-fit:cover'
    img.onerror = () => {
      img.remove()
      el.textContent = initials(profile.full_name)
    }
    el.appendChild(img)
  } else {
    el.textContent = initials(profile.full_name)
  }
  return L.divIcon({
    html: el,
    className: 'f4l-avatar-marker',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  })
}

function clusterIcon(count: number) {
  const el = document.createElement('div')
  el.textContent = count > 99 ? '99+' : String(count)
  el.style.cssText =
    'width:46px;height:46px;border-radius:9999px;background:#E8390E;color:#fff;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;font:700 14px system-ui,sans-serif'
  return L.divIcon({
    html: el,
    className: 'f4l-cluster-marker',
    iconSize: [46, 46],
    iconAnchor: [23, 23],
  })
}

function MapEvents({
  onView,
}: {
  onView: (view: { bounds: Bounds; zoom: number }) => void
}) {
  const map = useMapEvents({
    moveend: () => report(),
    zoomend: () => report(),
  })
  const report = useCallback(() => {
    const b = map.getBounds()
    const bounds = clampBounds({
      south: b.getSouth(),
      west: b.getWest(),
      north: b.getNorth(),
      east: b.getEast(),
    })
    if (bounds) onView({ bounds, zoom: map.getZoom() })
  }, [map, onView])
  useEffect(() => {
    report()
  }, [report])
  return null
}

function FlyTo({
  target,
}: {
  target: { center: [number, number]; zoom: number; n: number } | null
}) {
  const map = useMap()
  useEffect(() => {
    if (target) map.flyTo(target.center, target.zoom, { duration: 0.8 })
  }, [target, map])
  return null
}

function ClusterMarker({
  cluster,
  selectedId,
  onSelect,
  onZoomTo,
}: {
  cluster: Cluster<DiscoveryProfile>
  selectedId: string | null
  onSelect: (profile: DiscoveryProfile) => void
  onZoomTo: (lat: number, lng: number) => void
}) {
  const single = cluster.count === 1 ? cluster.members[0] : null
  const icon = useMemo(
    () =>
      single
        ? avatarIcon(single, single.id === selectedId)
        : clusterIcon(cluster.count),
    [single, cluster.count, selectedId],
  )
  return (
    <Marker
      position={[cluster.lat, cluster.lng]}
      icon={icon}
      keyboard
      title={
        single ? (single.full_name ?? 'Member') : `${cluster.count} members`
      }
      eventHandlers={{
        click: () =>
          single ? onSelect(single) : onZoomTo(cluster.lat, cluster.lng),
      }}
    />
  )
}

export default function DiscoveryMap() {
  const [view, setView] = useState<{ bounds: Bounds; zoom: number } | null>(
    null,
  )
  const [role, setRole] = useState<RoleFilter>('all')
  const [items, setItems] = useState<DiscoveryProfile[]>([])
  const [status, setStatus] = useState<
    'idle' | 'loading' | 'error' | 'unavailable'
  >('idle')
  const [hasMore, setHasMore] = useState(false)
  const [selected, setSelected] = useState<DiscoveryProfile | null>(null)
  const [fly, setFly] = useState<{
    center: [number, number]
    zoom: number
    n: number
  } | null>(null)
  const [areaId, setAreaId] = useState<string | null>(null)
  const [locating, setLocating] = useState<'idle' | 'busy' | 'denied'>('idle')
  const [visible, setVisible] = useState<boolean | null>(null)
  const [tick, setTick] = useState(0)
  const request = useRef(0)
  const lastCursor = useRef<string | null>(null)

  // Is the viewer themselves on the map? Shown as a gentle reminder, never a gate.
  useEffect(() => {
    getMyDiscovery()
      .then((mine) => setVisible(mine?.discoverable ?? false))
      .catch(() => setVisible(null))
  }, [])

  const roles = useMemo<('cook' | 'buyer')[] | null>(
    () => (role === 'all' ? null : [role]),
    [role],
  )

  // Debounce map movement so a pan does not fire a request per frame.
  const [settled, setSettled] = useState<typeof view>(null)
  useEffect(() => {
    if (!view) return
    const timer = setTimeout(() => setSettled(view), 350)
    return () => clearTimeout(timer)
  }, [view])

  // First page for the area being looked at. A newer request always wins, so a slow
  // answer for an area you have already left can never overwrite what is shown.
  useEffect(() => {
    if (!settled) return
    const mine = ++request.current
    setStatus('loading')
    fetchDiscoveryPage({ bounds: settled.bounds, roles })
      .then((rows) => {
        if (mine !== request.current) return
        setItems((previous) => {
          // Keep markers still inside the view (no flicker), refresh the rest.
          const inView = previous.filter(
            (p) =>
              p.lat >= settled.bounds.south &&
              p.lat <= settled.bounds.north &&
              p.lng >= settled.bounds.west &&
              p.lng <= settled.bounds.east &&
              (!roles || roles.includes(p.role)),
          )
          const fresh = new Set(rows.map((r) => r.id))
          return mergeProfiles(
            inView.filter((p) => fresh.has(p.id)),
            rows,
          )
        })
        lastCursor.current = rows.length ? rows[rows.length - 1].id : null
        setHasMore(rows.length >= DISCOVERY_PAGE_SIZE)
        setStatus('idle')
      })
      .catch((error) => {
        if (mine !== request.current) return
        setStatus(
          error instanceof DiscoveryUnavailableError ? 'unavailable' : 'error',
        )
      })
  }, [settled, roles, tick])

  // Pick up opt-outs, suspensions and profile edits without a page reload.
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === 'visible') setTick((n) => n + 1)
    }
    const timer = setInterval(refresh, 60_000)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [])

  async function loadMore() {
    if (!settled || !lastCursor.current) return
    const mine = request.current
    setStatus('loading')
    try {
      const rows = await fetchDiscoveryPage({
        bounds: settled.bounds,
        roles,
        after: lastCursor.current,
      })
      if (mine !== request.current) return
      setItems((previous) => mergeProfiles(previous, rows))
      lastCursor.current = rows.length
        ? rows[rows.length - 1].id
        : lastCursor.current
      setHasMore(rows.length >= DISCOVERY_PAGE_SIZE)
      setStatus('idle')
    } catch {
      setStatus('error')
    }
  }

  // The selected card must disappear if that member leaves the map.
  useEffect(() => {
    if (
      selected &&
      status === 'idle' &&
      !items.some((i) => i.id === selected.id)
    )
      setSelected(null)
  }, [items, selected, status])

  const clusters = useMemo(
    () => (view ? clusterProfiles(items, view.zoom) : []),
    [items, view],
  )

  function goTo(center: [number, number], zoom: number) {
    setFly({ center, zoom, n: Date.now() })
  }

  function locateMe() {
    if (!('geolocation' in navigator)) return setLocating('denied')
    setLocating('busy')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating('idle')
        setAreaId(null)
        // Used on this device only, to centre the map. Nothing is sent or saved.
        goTo([pos.coords.latitude, pos.coords.longitude], 13)
      },
      () => setLocating('denied'),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 },
    )
  }

  const returnPath = '/map'
  const cardHref = selected ? profileHref(selected, returnPath) : null
  const tooWide = view ? view.zoom < 10 : false

  return (
    <div className="relative h-[calc(100dvh-72px)] w-full overflow-hidden">
      <MapContainer
        center={[6.5244, 3.3792]}
        zoom={11}
        minZoom={5}
        scrollWheelZoom
        className="h-full w-full"
        keyboard
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapEvents onView={setView} />
        <FlyTo target={fly} />
        {clusters.map((cluster) => (
          <ClusterMarker
            key={cluster.key}
            cluster={cluster}
            selectedId={selected?.id ?? null}
            onSelect={setSelected}
            onZoomTo={(lat, lng) =>
              goTo([lat, lng], Math.min((view?.zoom ?? 11) + 2, 16))
            }
          />
        ))}
      </MapContainer>

      {/* Filters */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-[500] space-y-2 p-3">
        <div
          className="pointer-events-auto flex gap-2 overflow-x-auto pb-1"
          role="group"
          aria-label="Show members"
        >
          {ROLE_FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              aria-pressed={role === f.id}
              onClick={() => setRole(f.id)}
              className="min-h-11 shrink-0 rounded-full px-4 text-sm font-semibold shadow"
              style={{
                background: role === f.id ? 'var(--accent)' : 'var(--card)',
                color: role === f.id ? '#fff' : 'var(--text-1)',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div
          className="pointer-events-auto flex gap-2 overflow-x-auto pb-1"
          role="group"
          aria-label="Jump to an area"
        >
          <button
            type="button"
            onClick={locateMe}
            disabled={locating === 'busy'}
            className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-4 text-sm font-semibold shadow disabled:opacity-60"
            style={{ background: 'var(--card)', color: 'var(--text-1)' }}
          >
            <LocateFixed className="h-4 w-4" aria-hidden="true" />
            {locating === 'busy' ? 'Locating…' : 'Near me'}
          </button>
          {AREAS.map((a) => (
            <button
              key={a.id}
              type="button"
              aria-pressed={areaId === a.id}
              onClick={() => {
                setAreaId(a.id)
                goTo(a.center, 12)
              }}
              className="min-h-11 shrink-0 rounded-full px-4 text-sm font-semibold shadow"
              style={{
                background: areaId === a.id ? 'var(--accent)' : 'var(--card)',
                color: areaId === a.id ? '#fff' : 'var(--text-1)',
              }}
            >
              {a.label}
            </button>
          ))}
        </div>
        {locating === 'denied' && (
          <p
            role="status"
            className="pointer-events-auto inline-block rounded-xl px-3 py-2 text-xs shadow"
            style={{ background: 'var(--card)', color: 'var(--text-2)' }}
          >
            Location is blocked or unavailable. Pick an area above instead.
          </p>
        )}
      </div>

      {/* Status messages */}
      <div className="pointer-events-none absolute inset-x-0 bottom-24 z-[500] flex flex-col items-center gap-2 px-3">
        {status === 'loading' && (
          <p
            role="status"
            className="pointer-events-auto rounded-full px-4 py-2 text-xs font-semibold shadow"
            style={{ background: 'var(--card)', color: 'var(--text-2)' }}
          >
            Loading members…
          </p>
        )}
        {status === 'error' && (
          <button
            type="button"
            onClick={() => setTick((n) => n + 1)}
            className="pointer-events-auto inline-flex min-h-11 items-center gap-2 rounded-full px-5 text-sm font-semibold text-white shadow"
            style={{ background: 'var(--bubble-own)' }}
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Could not load the map. Try again
          </button>
        )}
        {status === 'unavailable' && (
          <p
            role="status"
            className="pointer-events-auto max-w-sm rounded-2xl px-4 py-3 text-center text-sm shadow"
            style={{ background: 'var(--card)', color: 'var(--text-1)' }}
          >
            Member discovery is not switched on yet. Check back soon.
          </p>
        )}
        {status === 'idle' && tooWide && (
          <p
            role="status"
            className="pointer-events-auto rounded-full px-4 py-2 text-xs shadow"
            style={{ background: 'var(--card)', color: 'var(--text-2)' }}
          >
            Zoom in to see members near the centre of the map.
          </p>
        )}
        {status === 'idle' && !tooWide && items.length === 0 && (
          <p
            role="status"
            className="pointer-events-auto max-w-xs rounded-2xl px-4 py-3 text-center text-sm shadow"
            style={{ background: 'var(--card)', color: 'var(--text-1)' }}
          >
            No one here has chosen to appear on the map yet.
          </p>
        )}
        {status === 'idle' && hasMore && (
          <button
            type="button"
            onClick={() => void loadMore()}
            className="pointer-events-auto min-h-11 rounded-full px-5 text-sm font-semibold shadow"
            style={{ background: 'var(--card)', color: 'var(--text-1)' }}
          >
            Show more people in this area
          </button>
        )}
        {visible === false && !selected && (
          <Link
            href="/settings#discovery"
            className="pointer-events-auto inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-xs font-semibold shadow"
            style={{ background: 'var(--card)', color: 'var(--text-1)' }}
          >
            <EyeOff className="h-4 w-4" aria-hidden="true" />
            You are hidden from the map. Change this
          </Link>
        )}
      </div>

      {/* Preview card */}
      {selected && (
        <section
          aria-label={`${selected.full_name ?? 'Member'} preview`}
          className="absolute inset-x-3 bottom-3 z-[600] mx-auto max-w-md rounded-3xl p-4 shadow-xl"
          style={{
            background: 'var(--card)',
            border: '1px solid var(--divider)',
          }}
        >
          <button
            type="button"
            onClick={() => setSelected(null)}
            aria-label="Close preview"
            className="absolute right-2 top-2 flex h-11 w-11 items-center justify-center rounded-full"
            style={{ color: 'var(--text-2)' }}
          >
            <X className="h-5 w-5" />
          </button>
          <div className="flex items-start gap-3 pr-10">
            <div
              className="h-16 w-16 shrink-0 overflow-hidden rounded-full border-2"
              style={{
                borderColor: RING[selected.role] ?? '#888',
                background: 'var(--accent-soft)',
              }}
            >
              {selected.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={selected.avatar_url}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="flex h-full w-full items-center justify-center font-bold">
                  {initials(selected.full_name)}
                </span>
              )}
            </div>
            <div className="min-w-0">
              <h2
                className="flex items-center gap-1.5 truncate font-heading text-lg font-bold"
                style={{ color: 'var(--text-1)' }}
              >
                <span className="truncate">
                  {selected.full_name ?? 'Food4Love member'}
                </span>
                {selected.verified && (
                  <BadgeCheck
                    className="h-4 w-4 shrink-0"
                    style={{ color: 'var(--success)' }}
                    aria-label="Verified"
                  />
                )}
              </h2>
              <p
                className="text-xs font-semibold"
                style={{ color: 'var(--accent)' }}
              >
                {selected.role === 'cook' ? 'Home chef' : 'Food lover'}
                {selected.role === 'cook' && selected.rating ? (
                  <span
                    className="ml-2 inline-flex items-center gap-0.5"
                    style={{ color: 'var(--text-2)' }}
                  >
                    <Star className="h-3 w-3" aria-hidden="true" />
                    {selected.rating.toFixed(1)}
                  </span>
                ) : null}
              </p>
              {selected.area_label && (
                <p
                  className="mt-0.5 flex items-center gap-1 text-xs"
                  style={{ color: 'var(--text-3)' }}
                >
                  <MapPin className="h-3 w-3" aria-hidden="true" />
                  {selected.area_label}
                </p>
              )}
            </div>
          </div>
          {selected.bio && (
            <p
              className="mt-3 line-clamp-3 text-sm"
              style={{ color: 'var(--text-2)' }}
            >
              {selected.bio}
            </p>
          )}
          {selected.cuisines && selected.cuisines.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {selected.cuisines.slice(0, 4).map((c) => (
                <span key={c} className="f4l-badge f4l-badge-muted">
                  {c}
                </span>
              ))}
            </div>
          )}
          {cardHref && (
            <Link
              href={cardHref}
              className="mt-4 flex min-h-11 w-full items-center justify-center rounded-full text-sm font-bold text-white"
              style={{ background: 'var(--accent)' }}
            >
              View profile
            </Link>
          )}
        </section>
      )}
    </div>
  )
}
