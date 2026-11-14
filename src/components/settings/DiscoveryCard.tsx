'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ChevronRight, Eye, EyeOff, Loader2, MapPin } from 'lucide-react'
import toast from 'react-hot-toast'
import {
  DiscoveryUnavailableError,
  getMyDiscovery,
  setMyDiscovery,
  type MyDiscovery,
} from '@/services/discovery'
import { DISCOVERY_AREAS, areaById } from '@/lib/discovery/areas'

// The consent control for the discovery map. Nothing is shared until the member
// switches it on here; switching it off deletes the saved area immediately.
export function DiscoveryCard() {
  const [mine, setMine] = useState<MyDiscovery | null>(null)
  const [state, setState] = useState<
    'loading' | 'ready' | 'unavailable' | 'error'
  >('loading')
  const [busy, setBusy] = useState(false)
  const [choosing, setChoosing] = useState(false)

  useEffect(() => {
    getMyDiscovery()
      .then((value) => {
        setMine(value)
        setState('ready')
      })
      .catch((error) =>
        setState(
          error instanceof DiscoveryUnavailableError ? 'unavailable' : 'error',
        ),
      )
  }, [])

  async function save(
    discoverable: boolean,
    position?: { lat: number; lng: number },
  ) {
    setBusy(true)
    try {
      setMine(await setMyDiscovery(discoverable, position))
      setChoosing(false)
      toast.success(
        discoverable
          ? 'You now appear on the map'
          : 'You are hidden and your saved area was deleted',
      )
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Could not update this setting',
      )
    } finally {
      setBusy(false)
    }
  }

  function useDevice() {
    if (!('geolocation' in navigator)) {
      setChoosing(true)
      return
    }
    setBusy(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setBusy(false)
        void save(true, { lat: pos.coords.latitude, lng: pos.coords.longitude })
      },
      () => {
        setBusy(false)
        toast('Location is blocked. Choose a city instead.')
        setChoosing(true)
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 },
    )
  }

  const on = mine?.discoverable === true

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
      <div className="flex items-start gap-3">
        <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent)]" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[var(--text-1)]">
            Show me on the discovery map
          </p>
          <p className="mt-1 text-xs leading-5 text-[var(--text-3)]">
            Off by default. If you switch it on, other members can see your
            photo, first and last name, short bio, interests and general area on
            the map. Only an approximate area (about 2&nbsp;km) is saved, never
            your exact location or address. Turn it off any time and the saved
            area is deleted at once.
          </p>

          {state === 'loading' && (
            <p className="mt-3 text-xs text-[var(--text-3)]" role="status">
              Checking your setting…
            </p>
          )}
          {state === 'error' && (
            <p className="mt-3 text-xs text-[var(--danger)]" role="alert">
              Could not load this setting. Refresh the page to try again.
            </p>
          )}
          {state === 'unavailable' && (
            <p className="mt-3 text-xs text-[var(--text-3)]" role="status">
              Map discovery is not switched on yet, so there is nothing to
              change. Your location is not shared.
            </p>
          )}

          {state === 'ready' && (
            <div className="mt-3 space-y-3">
              <p
                className="flex items-center gap-1.5 text-xs font-semibold"
                style={{ color: on ? 'var(--success)' : 'var(--text-2)' }}
                role="status"
              >
                {on ? (
                  <Eye className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <EyeOff className="h-4 w-4" aria-hidden="true" />
                )}
                {on ? 'You appear on the map' : 'You are hidden from the map'}
              </p>

              {on ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void save(false)}
                  className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[var(--border)] px-5 text-sm font-semibold text-[var(--text-1)] disabled:opacity-60"
                >
                  {busy && (
                    <Loader2
                      className="h-4 w-4 animate-spin"
                      aria-hidden="true"
                    />
                  )}
                  Hide me and delete my saved area
                </button>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={useDevice}
                    className="inline-flex min-h-11 items-center gap-2 rounded-full px-5 text-sm font-bold text-white disabled:opacity-60"
                    style={{ background: 'var(--accent)' }}
                  >
                    {busy && (
                      <Loader2
                        className="h-4 w-4 animate-spin"
                        aria-hidden="true"
                      />
                    )}
                    Show me, using my device location
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setChoosing((v) => !v)}
                    className="inline-flex min-h-11 items-center rounded-full border border-[var(--border)] px-5 text-sm font-semibold text-[var(--text-1)] disabled:opacity-60"
                  >
                    Choose a city instead
                  </button>
                </div>
              )}

              {choosing && !on && (
                <div
                  className="flex flex-wrap gap-2"
                  role="group"
                  aria-label="Choose a city"
                >
                  {DISCOVERY_AREAS.map((area) => (
                    <button
                      key={area.id}
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        const chosen = areaById(area.id)
                        if (chosen)
                          void save(true, {
                            lat: chosen.center[0],
                            lng: chosen.center[1],
                          })
                      }}
                      className="min-h-11 rounded-full border border-[var(--border)] px-4 text-sm font-semibold text-[var(--text-1)] disabled:opacity-60"
                    >
                      {area.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <Link
            href="/map"
            className="mt-3 inline-flex min-h-11 items-center gap-1 text-xs font-semibold text-[var(--accent)] hover:underline"
          >
            Open map <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </div>
  )
}
