'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { usePathname } from 'next/navigation'
import { Download, RefreshCw, X } from 'lucide-react'

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

type PwaContextValue = {
  ready: boolean
  installed: boolean
  canInstall: boolean
  isIos: boolean
  isAndroid: boolean
  installInstructions: string
  requestInstall: () => Promise<void>
}

const PwaContext = createContext<PwaContextValue | null>(null)
const DISMISSED_KEY = 'food4love-install-suggestion-dismissed'

export function usePwa() {
  const value = useContext(PwaContext)
  if (!value) throw new Error('usePwa must be used inside PwaProvider')
  return value
}

export function PwaProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const deferredPrompt = useRef<InstallPromptEvent | null>(null)
  const registration = useRef<ServiceWorkerRegistration | null>(null)
  const updateRequested = useRef(false)
  const [ready, setReady] = useState(false)
  const [installed, setInstalled] = useState(false)
  const [canInstall, setCanInstall] = useState(false)
  const [isIos, setIsIos] = useState(false)
  const [isAndroid, setIsAndroid] = useState(false)
  const [showInstallInstructions, setShowInstallInstructions] = useState(false)
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [suggestionDismissed, setSuggestionDismissed] = useState(true)

  const requestInstall = useCallback(async () => {
    const prompt = deferredPrompt.current
    if (!prompt) {
      setShowInstallInstructions(true)
      return
    }

    deferredPrompt.current = null
    setCanInstall(false)
    try {
      await prompt.prompt()
      const choice = await prompt.userChoice
      if (choice.outcome === 'accepted') setInstalled(true)
    } catch {
      setShowInstallInstructions(true)
    }
  }, [])

  useEffect(() => {
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
    const appleMobile =
      /iphone|ipad|ipod/i.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
    const android = /android/i.test(navigator.userAgent)

    setInstalled(standalone)
    setIsIos(appleMobile)
    setIsAndroid(android)
    try {
      setSuggestionDismissed(
        window.localStorage.getItem(DISMISSED_KEY) === 'true',
      )
    } catch {
      setSuggestionDismissed(false)
    }
    setReady(true)

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault()
      deferredPrompt.current = event as InstallPromptEvent
      setCanInstall(true)
    }
    const onInstalled = () => {
      deferredPrompt.current = null
      setCanInstall(false)
      setInstalled(true)
      setShowInstallInstructions(false)
    }

    window.addEventListener(
      'beforeinstallprompt',
      onBeforeInstallPrompt as EventListener,
    )
    window.addEventListener('appinstalled', onInstalled)

    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      let disposed = false
      const watchRegistration = (swRegistration: ServiceWorkerRegistration) => {
        registration.current = swRegistration
        if (swRegistration.waiting && navigator.serviceWorker.controller)
          setUpdateAvailable(true)

        swRegistration.addEventListener('updatefound', () => {
          const installing = swRegistration.installing
          installing?.addEventListener('statechange', () => {
            if (
              installing.state === 'installed' &&
              navigator.serviceWorker.controller
            ) {
              setUpdateAvailable(true)
            }
          })
        })
      }

      void navigator.serviceWorker
        .register('/sw.js', { scope: '/', updateViaCache: 'none' })
        .then((swRegistration) => {
          if (disposed) return
          watchRegistration(swRegistration)
          void swRegistration.update().catch(() => undefined)
        })
        .catch((error) => {
          console.error('Food4Love offline support could not start', error)
        })

      const updateWhenOnline = () => {
        if (navigator.onLine)
          void registration.current?.update().catch(() => undefined)
      }
      const updateWhenVisible = () => {
        if (document.visibilityState === 'visible') updateWhenOnline()
      }
      window.addEventListener('online', updateWhenOnline)
      window.addEventListener('focus', updateWhenOnline)
      document.addEventListener('visibilitychange', updateWhenVisible)
      const updateTimer = window.setInterval(updateWhenOnline, 60 * 60 * 1000)

      const onControllerChange = () => {
        if (!updateRequested.current) return
        updateRequested.current = false
        window.location.reload()
      }
      navigator.serviceWorker.addEventListener(
        'controllerchange',
        onControllerChange,
      )

      return () => {
        disposed = true
        window.removeEventListener('online', updateWhenOnline)
        window.removeEventListener('focus', updateWhenOnline)
        document.removeEventListener('visibilitychange', updateWhenVisible)
        window.clearInterval(updateTimer)
        navigator.serviceWorker.removeEventListener(
          'controllerchange',
          onControllerChange,
        )
        window.removeEventListener(
          'beforeinstallprompt',
          onBeforeInstallPrompt as EventListener,
        )
        window.removeEventListener('appinstalled', onInstalled)
      }
    }

    return () => {
      window.removeEventListener(
        'beforeinstallprompt',
        onBeforeInstallPrompt as EventListener,
      )
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const installInstructions = isIos
    ? 'On your iPhone or iPad, open Food4Love in Safari, tap Share, then choose Add to Home Screen.'
    : isAndroid
      ? 'Tap Install App for the Android install prompt. If it is unavailable, open the browser menu and choose Install app or Add to Home screen.'
      : 'Open your browser menu and choose Install Food4Love or Add to Home screen.'

  const contextValue = useMemo(
    () => ({
      ready,
      installed,
      canInstall,
      isIos,
      isAndroid,
      installInstructions,
      requestInstall,
    }),
    [
      ready,
      installed,
      canInstall,
      isIos,
      isAndroid,
      installInstructions,
      requestInstall,
    ],
  )

  const dismissSuggestion = () => {
    setSuggestionDismissed(true)
    try {
      window.localStorage.setItem(DISMISSED_KEY, 'true')
    } catch {
      // Dismissal remains in effect for this page session.
    }
  }

  const applyUpdate = () => {
    const waitingWorker = registration.current?.waiting
    if (!waitingWorker) {
      void registration.current?.update().catch(() => undefined)
      return
    }
    updateRequested.current = true
    waitingWorker.postMessage({ type: 'SKIP_WAITING' })
  }

  const showSuggestion =
    ready &&
    pathname === '/swipe' &&
    !installed &&
    !suggestionDismissed &&
    (isIos || isAndroid || canInstall)

  return (
    <PwaContext.Provider value={contextValue}>
      {children}

      {showInstallInstructions && (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-black/45 p-4 sm:items-center"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget)
              setShowInstallInstructions(false)
          }}
        >
          <section
            aria-labelledby="pwa-install-title"
            aria-modal="true"
            className="w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 text-[var(--text-1)] shadow-2xl"
            role="dialog"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="pwa-install-title" className="font-semibold">
                  Install Food4Love
                </h2>
                <p className="mt-2 text-sm leading-6 text-[var(--text-2)]">
                  {installInstructions}
                </p>
              </div>
              <button
                type="button"
                aria-label="Close installation instructions"
                onClick={() => setShowInstallInstructions(false)}
                className="rounded-lg p-2 text-[var(--text-2)] hover:bg-[var(--bg-2)]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </section>
        </div>
      )}

      {showSuggestion && (
        <aside
          aria-label="Install Food4Love"
          className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] left-3 right-3 z-40 flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-3 text-[var(--text-1)] shadow-xl sm:bottom-5 sm:left-auto sm:right-5 sm:w-[22rem]"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
            <Download aria-hidden="true" className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Take Food4Love with you</p>
            <p className="mt-0.5 text-xs text-[var(--text-2)]">
              Add it to your home screen for quicker access.
            </p>
            <button
              type="button"
              onClick={() => void requestInstall()}
              className="mt-2 text-xs font-bold text-[var(--accent)] underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            >
              Install App
            </button>
          </div>
          <button
            type="button"
            aria-label="Dismiss install suggestion"
            onClick={dismissSuggestion}
            className="self-start rounded-lg p-2 text-[var(--text-3)] hover:bg-[var(--bg-2)] hover:text-[var(--text-1)]"
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        </aside>
      )}

      {updateAvailable && (
        <aside
          aria-live="polite"
          className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] left-3 right-3 z-50 flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--card)] p-3 text-[var(--text-1)] shadow-xl sm:bottom-5 sm:left-auto sm:right-5 sm:w-auto"
        >
          <p className="flex-1 text-sm">A Food4Love update is ready.</p>
          <button
            type="button"
            onClick={applyUpdate}
            className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[var(--accent)] px-3 text-sm font-semibold text-white"
          >
            <RefreshCw aria-hidden="true" className="h-4 w-4" /> Update
          </button>
        </aside>
      )}
    </PwaContext.Provider>
  )
}
