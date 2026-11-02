'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useSwipeDeck } from '@/hooks/useSwipeDeck'
import { useAuthStore } from '@/stores/useAuthStore'
import { SwipeCard, Chef } from '@/components/swipe/SwipeCard'
import { SwipeActions } from '@/components/swipe/SwipeActions'
import { MatchCelebration } from '@/components/swipe/MatchCelebration'
import { AppPage } from '@/components/ui/AppPage'
import { Button } from '@/components/ui/Button'
import Link from 'next/link'
import { recordSwipe } from '@/services/swipes'
import { SlidersHorizontal, X, Check, MapPin } from 'lucide-react'
import {
  motion,
  AnimatePresence,
  useMotionValue,
  useTransform,
  PanInfo,
} from 'framer-motion'
import toast from 'react-hot-toast'
import { NotificationCenter } from '@/components/notifications/NotificationCenter'
import { CookTodayStrip } from '@/components/cook/CookTodayStrip'
import { StoryHighlights } from '@/components/stories/StoryHighlights'
import { ChefChiAvatar } from '@/components/chat/ChefChiAvatar'
import {
  DiscoverGreeting,
  HeaderAurora,
} from '@/components/swipe/DiscoverAmbience'

const CUISINES = [
  'Igbo Cuisine',
  'Yoruba Cuisine',
  'Hausa Cuisine',
  'Jollof & Rice',
  'Nigerian BBQ',
  'Soups & Stew',
  'Swallow',
  'Small Chops',
  'Seafood',
  'Pastries',
  'Continental',
  'Suya & Grills',
]

interface Filters {
  cuisines: string[]
  priceMax: number
  distance: number
}

export default function SwipePage() {
  const { profile } = useAuthStore()

  const [deck, setDeck] = useState<Chef[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isAnimating, setIsAnimating] = useState(false)
  const [exitDirection, setExitDirection] = useState<'left' | 'right' | null>(
    null,
  )
  const [showMatch, setShowMatch] = useState(false)
  const [matchedChef, setMatchedChef] = useState<Chef | null>(null)

  const [showFilter, setShowFilter] = useState(false)
  const [filters, setFilters] = useState<Filters>({
    cuisines: [],
    priceMax: 50000,
    distance: 20,
  })
  const [pendingFilters, setPendingFilters] = useState<Filters>({
    cuisines: [],
    priceMax: 50000,
    distance: 20,
  })
  const canFilterPrice = profile?.role === 'buyer'
  const isCook = profile?.role === 'cook'
  const firstName = profile?.full_name?.trim().split(' ')[0]
  const activeFilters =
    filters.cuisines.length > 0 || (canFilterPrice && filters.priceMax < 50000)

  const swipeFilters = useMemo(
    () =>
      activeFilters
        ? {
            cuisines: filters.cuisines,
            priceMax: filters.priceMax,
            distance: filters.distance,
          }
        : undefined,
    [activeFilters, filters.cuisines, filters.priceMax, filters.distance],
  )

  const { data, isLoading, error, refetch } = useSwipeDeck(swipeFilters)

  useEffect(() => {
    if (data && data.length > 0 && deck.length === 0) {
      setDeck(data)
      setCurrentIndex(0)
    }
  }, [data, deck.length])

  const current = deck[currentIndex]
  const next = deck[currentIndex + 1]
  const remaining = deck.length - currentIndex

  const dragX = useMotionValue(0)
  const dragRotate = useTransform(dragX, [-200, 200], [-12, 12])
  const opacityLike = useTransform(dragX, [80, 160], [0, 1])
  const opacityPass = useTransform(dragX, [-160, -80], [1, 0])

  const handleSwipe = useCallback(
    async (action: 'like' | 'pass') => {
      if (!current || !profile || isAnimating) return

      const direction = action === 'like' ? 'right' : 'left'
      setExitDirection(direction)
      setIsAnimating(true)

      await new Promise((resolve) => setTimeout(resolve, 400))

      try {
        const result = await recordSwipe(current.id, action)
        if (result.match) {
          setMatchedChef(current)
          setShowMatch(true)
        }
      } catch (err) {
        setIsAnimating(false)
        setExitDirection(null)
        toast.error(
          err instanceof Error ? err.message : 'Your swipe could not be saved.',
        )
        return
      }

      setCurrentIndex((prev) => prev + 1)
      setIsAnimating(false)
      setExitDirection(null)
    },
    [current, profile, isAnimating],
  )

  const handleDragEnd = useCallback(
    (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      if (!current || !profile || isAnimating) return
      const threshold = 100

      if (info.offset.x > threshold) {
        setExitDirection('right')
        handleSwipe('like')
      } else if (info.offset.x < -threshold) {
        setExitDirection('left')
        handleSwipe('pass')
      }
    },
    [current, profile, isAnimating, handleSwipe],
  )

  // Arrow keys work on desktop: left to pass, right to like.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
        return
      if (e.key === 'ArrowRight') handleSwipe('like')
      if (e.key === 'ArrowLeft') handleSwipe('pass')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handleSwipe])

  const applyFilters = () => {
    setFilters(pendingFilters)
    setDeck([])
    setCurrentIndex(0)
    setShowFilter(false)
  }

  const clearFilters = () => {
    const reset = { cuisines: [], priceMax: 50000, distance: 20 }
    setFilters(reset)
    setPendingFilters(reset)
    setDeck([])
    setCurrentIndex(0)
  }

  const toggleCuisine = (c: string) => {
    setPendingFilters((p) => ({
      ...p,
      cuisines: p.cuisines.includes(c)
        ? p.cuisines.filter((x) => x !== c)
        : [...p.cuisines, c],
    }))
  }

  return (
    <AppPage
      ambient="pepper"
      ambientIntensity="low"
      fullHeight
      className="relative overflow-hidden"
    >
      {/* The page glows green or red as the card is dragged */}
      <motion.div
        aria-hidden
        style={{ opacity: opacityLike }}
        className="pointer-events-none absolute inset-0 z-0 bg-gradient-to-l from-emerald-400/20 via-transparent to-transparent"
      />
      <motion.div
        aria-hidden
        style={{ opacity: opacityPass }}
        className="pointer-events-none absolute inset-0 z-0 bg-gradient-to-r from-rose-400/20 via-transparent to-transparent"
      />

      <HeaderAurora />

      {/* Header */}
      <div
        data-tour="discovery"
        className="relative z-10 flex shrink-0 items-center justify-between gap-2 px-4 pb-3 pt-4"
      >
        <DiscoverGreeting
          firstName={firstName}
          streak={profile?.streak ?? 0}
          title={isCook ? 'Food lovers near you' : 'Chefs near you'}
        />

        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <Link
            href="/map"
            aria-label="Open map"
            title="Map"
            className="hover:border-[var(--accent)]/50 group flex h-10 w-10 shrink-0 items-center overflow-hidden rounded-full border border-[var(--border)] bg-[var(--card)] text-[var(--text-1)] shadow-sm backdrop-blur-xl transition-[width,border-color] duration-200 hover:w-[4.75rem] focus-visible:w-[4.75rem] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] active:scale-95"
          >
            <MapPin className="ml-3 h-4 w-4 shrink-0 text-[var(--accent)]" />
            <span className="ml-1 max-w-0 overflow-hidden text-xs font-semibold opacity-0 transition-[max-width,opacity] duration-200 group-hover:max-w-8 group-hover:opacity-100 group-focus-visible:max-w-8 group-focus-visible:opacity-100">
              Map
            </span>
          </Link>
          {activeFilters && (
            <button
              onClick={clearFilters}
              aria-label="Clear filters"
              className="shrink-0 rounded-full bg-[var(--accent-soft)] px-2.5 py-2 text-xs font-semibold text-[var(--accent)] transition-colors sm:px-3"
            >
              <X className="h-4 w-4 sm:hidden" />
              <span className="hidden sm:inline">Clear</span>
            </button>
          )}
          <NotificationCenter />
          <button
            data-tour="filter"
            onClick={() => {
              setPendingFilters(filters)
              setShowFilter(true)
            }}
            aria-label="Filters"
            className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--card)] shadow-sm backdrop-blur-xl transition active:scale-95"
          >
            <SlidersHorizontal className="h-4 w-4 text-[var(--text-2)]" />
            {activeFilters && (
              <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-[var(--bg)] bg-[var(--accent)]" />
            )}
          </button>
        </div>
      </div>

      {profile?.role === 'cook' ? <CookTodayStrip /> : <StoryHighlights />}

      {/* Card Area */}
      <div
        data-tour={
          !isLoading && (deck.length > 0 || (data?.length ?? 0) === 0)
            ? 'discovery-ready'
            : undefined
        }
        className="relative z-10 flex min-h-0 flex-1 flex-col items-center justify-center px-4 pb-24 pt-1"
      >
        {isLoading && deck.length === 0 ? (
          <div className="min-h-0 w-full max-w-sm flex-1 animate-pulse rounded-[28px] border border-[var(--border)] bg-[var(--card)] shadow-xl" />
        ) : error && !data ? (
          <div className="flex max-w-sm flex-col items-center gap-3 px-6 text-center">
            <h3 className="text-lg font-bold text-[var(--text-1)]">
              Discovery could not load
            </h3>
            <p className="text-sm text-[var(--text-3)]">
              Your profile and matching settings are unchanged. Try loading the
              discovery pool again.
            </p>
            <Button
              onClick={() => {
                setDeck([])
                setCurrentIndex(0)
                refetch()
              }}
              variant="primary"
              size="md"
              pill
            >
              Try again
            </Button>
          </div>
        ) : !current ? (
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center gap-3 px-6 text-center"
          >
            <ChefChiAvatar size={116} className="shadow-lift" />
            <h3 className="font-heading text-xl font-bold text-[var(--text-1)]">
              {activeFilters
                ? 'No one matches those filters'
                : "You've seen everyone for now"}
            </h3>
            <p className="max-w-[260px] text-sm leading-relaxed text-[var(--text-3)]">
              {activeFilters
                ? 'Try widening your search.'
                : isCook
                  ? 'New food lovers join every day. Check back soon, or post a story to get noticed.'
                  : 'New chefs join every day. Check back soon.'}
            </p>
            <div className="mt-1 flex flex-wrap justify-center gap-3">
              {activeFilters && (
                <Button
                  onClick={clearFilters}
                  variant="secondary"
                  size="md"
                  pill
                >
                  Clear Filters
                </Button>
              )}
              <Button
                onClick={() => {
                  setDeck([])
                  setCurrentIndex(0)
                  refetch()
                }}
                variant="primary"
                size="md"
                pill
              >
                Refresh
              </Button>
            </div>
            {isCook && (
              <Link
                href="/stories"
                className="text-xs font-semibold text-[var(--accent)]"
              >
                Post a story →
              </Link>
            )}
          </motion.div>
        ) : (
          <>
            <div className="relative max-h-[640px] min-h-0 w-full max-w-sm flex-1">
              {next && (
                <div
                  aria-hidden
                  className="saturate-75 pointer-events-none absolute inset-0 origin-bottom translate-y-3 scale-[0.94] opacity-70"
                >
                  <SwipeCard chef={next} />
                </div>
              )}
              <AnimatePresence mode="popLayout">
                <motion.div
                  key={current.id}
                  drag="x"
                  dragConstraints={{ left: 0, right: 0 }}
                  dragElastic={0.9}
                  onDragEnd={handleDragEnd}
                  style={{ x: dragX, rotate: dragRotate }}
                  initial={{ opacity: 0, scale: 0.92, y: 24 }}
                  animate={{ opacity: 1, scale: 1, y: 0, x: 0, rotate: 0 }}
                  exit={{
                    x:
                      exitDirection === 'right'
                        ? 500
                        : exitDirection === 'left'
                          ? -500
                          : dragX.get() > 0
                            ? 500
                            : -500,
                    opacity: 0,
                    rotate:
                      exitDirection === 'right'
                        ? 20
                        : exitDirection === 'left'
                          ? -20
                          : dragX.get() > 0
                            ? 20
                            : -20,
                    transition: { duration: 0.4, ease: [0.32, 0.72, 0, 1] },
                  }}
                  transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                  className="absolute inset-0 touch-none"
                >
                  <motion.div
                    style={{ opacity: opacityLike }}
                    className="pointer-events-none absolute left-6 top-8 z-20 -rotate-12 rounded-xl border-2 border-emerald-300 bg-black/25 px-4 py-1.5 text-2xl font-black uppercase tracking-[0.2em] text-emerald-300 backdrop-blur-md"
                  >
                    Like
                  </motion.div>
                  <motion.div
                    style={{ opacity: opacityPass }}
                    className="pointer-events-none absolute right-6 top-8 z-20 rotate-12 rounded-xl border-2 border-rose-300 bg-black/25 px-4 py-1.5 text-2xl font-black uppercase tracking-[0.2em] text-rose-300 backdrop-blur-md"
                  >
                    Pass
                  </motion.div>

                  <SwipeCard chef={current} />
                </motion.div>
              </AnimatePresence>
            </div>

            <div className="mt-4 shrink-0">
              <SwipeActions
                onPass={() => handleSwipe('pass')}
                onLike={() => handleSwipe('like')}
                onSuperlike={() => handleSwipe('like')}
                disabled={!current || isAnimating}
              />
            </div>

            <p className="mt-1 shrink-0 text-xs font-medium text-[var(--text-3)]">
              {remaining} {isCook ? 'food lover' : 'chef'}
              {remaining !== 1 ? 's' : ''} to see
            </p>
          </>
        )}
      </div>

      {/* Filter Modal */}
      <AnimatePresence>
        {showFilter && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
              onClick={() => setShowFilter(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center p-4"
            >
              <div
                className="scrollbar-none pointer-events-auto max-h-[85vh] w-full max-w-sm overflow-y-auto rounded-3xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="mb-6 flex items-center justify-between">
                  <h3 className="text-lg font-bold text-[var(--text-1)]">
                    {canFilterPrice ? 'Filter Chefs' : 'Filter Food Lovers'}
                  </h3>
                  <button
                    onClick={() => setShowFilter(false)}
                    className="rounded-full p-2 transition-colors hover:bg-[var(--bg-2)]"
                  >
                    <X className="h-5 w-5 text-[var(--text-3)]" />
                  </button>
                </div>

                {canFilterPrice && (
                  <div className="mb-6">
                    <p className="mb-3 text-sm font-bold text-[var(--text-1)]">
                      Cuisine Type
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {CUISINES.map((c) => {
                        const selected = pendingFilters.cuisines.includes(c)
                        return (
                          <button
                            key={c}
                            onClick={() => toggleCuisine(c)}
                            className={`flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-semibold transition-all ${selected ? 'border-[var(--accent)] bg-[var(--accent)] text-white' : 'hover:border-[var(--accent)]/50 border-[var(--border)] bg-[var(--bg-2)] text-[var(--text-3)]'}`}
                          >
                            {selected && <Check className="h-3 w-3" />}
                            {c}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                <div className="mb-6">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-sm font-bold text-[var(--text-1)]">
                      Max Price
                    </p>
                    <span className="text-sm font-bold text-[var(--accent)]">
                      ₦{pendingFilters.priceMax.toLocaleString()}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={2000}
                    max={50000}
                    step={1000}
                    value={pendingFilters.priceMax}
                    onChange={(e) =>
                      setPendingFilters((p) => ({
                        ...p,
                        priceMax: Number(e.target.value),
                      }))
                    }
                    className="w-full"
                  />
                  <div className="mt-1 flex justify-between text-xs text-[var(--text-3)]">
                    <span>₦2,000</span>
                    <span>₦50,000</span>
                  </div>
                </div>

                <Button
                  onClick={applyFilters}
                  variant="primary"
                  size="lg"
                  fullWidth
                  pill
                >
                  Apply Filters
                  {(pendingFilters.cuisines.length > 0 ||
                    (canFilterPrice && pendingFilters.priceMax < 50000)) && (
                    <span className="ml-2 rounded-full bg-white/20 px-2 py-0.5 text-xs">
                      {pendingFilters.cuisines.length +
                        (canFilterPrice && pendingFilters.priceMax < 50000
                          ? 1
                          : 0)}{' '}
                      active
                    </span>
                  )}
                </Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <MatchCelebration
        isOpen={showMatch}
        matchedChef={matchedChef}
        currentUser={profile}
        onClose={() => {
          setShowMatch(false)
          setMatchedChef(null)
        }}
      />
    </AppPage>
  )
}
