'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSwipeDeck } from '@/hooks/useSwipeDeck'
import { useAuthStore } from '@/stores/useAuthStore'
import { SwipeCard, Chef } from '@/components/swipe/SwipeCard'
import { SwipeActions } from '@/components/swipe/SwipeActions'
import { MatchCelebration } from '@/components/swipe/MatchCelebration'
import { AppPage } from '@/components/ui/AppPage'
import { Button } from '@/components/ui/Button'
import { recordSwipe, checkMutualLike } from '@/services/swipes'
import { createMatch } from '@/services/matches'
import { SlidersHorizontal, Flame, X, Check } from 'lucide-react'
import {
  motion,
  AnimatePresence,
  useMotionValue,
  useTransform,
  PanInfo,
} from 'framer-motion'
import toast from 'react-hot-toast'
import { Bell } from 'lucide-react'
import Link from 'next/link'
import { useNotifications } from '@/hooks/useNotifications'
import { NavBadge } from '@/components/layout/NavBadge'

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
  // const profile = useAuthStore((s) => s.profile)

  // TEMPORARY DEBUG — add this inside the SwipePage component
  const { profile } = useAuthStore()
  console.log('🚨 SWIPE PAGE — profile:', profile)
  console.log('🚨 SWIPE PAGE — userId:', profile?.id)

  const { unreadCount } = useNotifications()

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
  const activeFilters = filters.cuisines.length > 0 || filters.priceMax < 50000

  const { data, isLoading, refetch } = useSwipeDeck(
    activeFilters
      ? {
          cuisines: filters.cuisines,
          priceMax: filters.priceMax,
          distance: filters.distance,
        }
      : undefined,
  )

  useEffect(() => {
    if (data && data.length > 0 && deck.length === 0) {
      setDeck(data)
      setCurrentIndex(0)
    }
  }, [data, deck.length])

  const current = deck[currentIndex]
  const remaining = deck.length - currentIndex

  // Drag motion values for stamps
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

      setTimeout(async () => {
        setCurrentIndex((prev) => prev + 1)
        setIsAnimating(false)
        setExitDirection(null)

        try {
          await recordSwipe(profile.id, current.id, action)
          if (action === 'like') {
            const mutual = await checkMutualLike(profile.id, current.id)
            if (mutual) {
              const m = await createMatch(profile.id, current.id)
              setMatchedChef(current)
              setShowMatch(true)
            }
          }
        } catch (err) {
          console.error('Swipe error:', err)
          toast.error('Something went wrong')
        }
      }, 400)
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
      {/* Inline background animations */}
      <style jsx global>{`
        @keyframes orb1 {
          0%,
          100% {
            transform: translate(0, 0) scale(1);
          }
          50% {
            transform: translate(50px, -40px) scale(1.08);
          }
        }
        @keyframes orb2 {
          0%,
          100% {
            transform: translate(0, 0) scale(1);
          }
          50% {
            transform: translate(-40px, 30px) scale(1.05);
          }
        }
        @keyframes orb3 {
          0%,
          100% {
            transform: translate(0, 0);
            opacity: 0.5;
          }
          50% {
            transform: translate(30px, -20px);
            opacity: 1;
          }
        }
        @keyframes floatEmoji {
          0%,
          100% {
            transform: translateY(0) rotate(0deg);
          }
          50% {
            transform: translateY(-25px) rotate(8deg);
          }
        }
      `}</style>

      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div
          className="absolute left-[-15%] top-[-15%] h-[600px] w-[600px] rounded-full bg-[#e85a2a] opacity-[0.12] blur-[120px]"
          style={{ animation: 'orb1 18s ease-in-out infinite' }}
        />
        <div
          className="absolute bottom-[-15%] right-[-15%] h-[500px] w-[500px] rounded-full bg-amber-400 opacity-[0.10] blur-[100px]"
          style={{ animation: 'orb2 22s ease-in-out infinite' }}
        />
        <div
          className="absolute left-[50%] top-[40%] h-[400px] w-[400px] rounded-full bg-green-400 opacity-[0.08] blur-[90px]"
          style={{ animation: 'orb3 14s ease-in-out infinite' }}
        />

        {['🍲', '🍛', '🥘', '🍗', '🌶️', '🥥'].map((emoji, i) => (
          <span
            key={i}
            className="absolute select-none text-3xl"
            style={{
              left: `${8 + i * 16}%`,
              top: `${5 + (i % 3) * 30}%`,
              opacity: 0.18,
              animation: `floatEmoji ${9 + i * 2}s ease-in-out infinite`,
              animationDelay: `${i * 0.6}s`,
            }}
          >
            {emoji}
          </span>
        ))}

        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `radial-gradient(circle, #2f211b 1.5px, transparent 1.5px)`,
            backgroundSize: '30px 30px',
          }}
        />
      </div>

      {/* Header */}
      <div className="relative z-10 flex shrink-0 items-center justify-between px-4 pb-2 pt-4">
        <div className="flex items-center gap-2">
          <Flame className="h-5 w-5 text-[var(--primary)]" />
          <h1 className="text-lg font-bold text-[var(--text)]">Discover</h1>
          {profile?.streak && profile.streak > 1 && (
            <span className="bg-[var(--primary)]/10 flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-bold text-[var(--primary)]">
              <Flame className="h-3 w-3" /> {profile.streak}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {activeFilters && (
            <button
              onClick={clearFilters}
              className="bg-[var(--primary)]/10 hover:bg-[var(--primary)]/20 rounded-full px-3 py-1.5 text-xs font-semibold text-[var(--primary)] transition-colors"
            >
              Clear
            </button>
          )}
          <Link href="/notifications" className="relative">
            <Bell className="h-6 w-6 text-[var(--text)]" />
            {unreadCount > 0 && <NavBadge count={unreadCount} />}
          </Link>
          <button
            onClick={() => {
              setPendingFilters(filters)
              setShowFilter(true)
            }}
            className="hover:border-[var(--primary)]/50 relative flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--card)] transition-colors active:scale-95"
          >
            <SlidersHorizontal className="h-4 w-4 text-[var(--text-muted)]" />
            {activeFilters && (
              <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-[var(--primary)]" />
            )}
          </button>
        </div>
      </div>

      {/* Card Area */}
      <div className="relative z-10 flex min-h-0 flex-1 flex-col items-center justify-center px-4 py-4">
        {isLoading && deck.length === 0 ? (
          <div className="aspect-[3/4] w-full max-w-sm animate-pulse rounded-[32px] border border-[var(--border)] bg-[var(--card)] shadow-xl" />
        ) : !current ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center gap-4 px-6 text-center"
          >
            <div className="mb-2 text-6xl">🍽️</div>
            <h3 className="text-xl font-bold text-[var(--text)]">
              {activeFilters
                ? 'No chefs match filters'
                : "You've seen everyone!"}
            </h3>
            <p className="max-w-[240px] text-sm text-[var(--text-muted)]">
              {activeFilters
                ? 'Try broadening your search'
                : 'New chefs join daily. Check back soon!'}
            </p>
            <div className="mt-2 flex gap-3">
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
          </motion.div>
        ) : (
          <>
            {/* CARD WRAPPER — handles drag, stamps, and exit */}
            <div className="relative aspect-[3/4] max-h-[65vh] w-full max-w-sm">
              <AnimatePresence mode="popLayout">
                <motion.div
                  key={current.id}
                  drag="x"
                  dragConstraints={{ left: 0, right: 0 }}
                  dragElastic={0.9}
                  onDragEnd={handleDragEnd}
                  style={{ x: dragX, rotate: dragRotate }}
                  initial={{ opacity: 0, scale: 0.9, y: 30 }}
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
                  {/* LIKE / NOPE Stamps */}
                  <motion.div
                    style={{ opacity: opacityLike }}
                    className="pointer-events-none absolute left-8 top-10 z-20 -rotate-12 rounded-2xl border-[3px] border-[#4ade80] px-5 py-2 text-3xl font-black uppercase tracking-[0.15em] text-[#4ade80] shadow-lg"
                  >
                    LIKE
                  </motion.div>
                  <motion.div
                    style={{ opacity: opacityPass }}
                    className="pointer-events-none absolute right-8 top-10 z-20 rotate-12 rounded-2xl border-[3px] border-[#ff4458] px-5 py-2 text-3xl font-black uppercase tracking-[0.15em] text-[#ff4458] shadow-lg"
                  >
                    NOPE
                  </motion.div>

                  {/* Card Content */}
                  <SwipeCard chef={current} />
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Action Buttons */}
            <div className="mt-6 shrink-0">
              <SwipeActions
                onPass={() => handleSwipe('pass')}
                onLike={() => handleSwipe('like')}
                onSuperlike={() => handleSwipe('like')}
                disabled={!current || isAnimating}
              />
            </div>

            <p className="mt-3 text-xs font-medium text-[var(--text-muted)]">
              {remaining} chef{remaining !== 1 ? 's' : ''} remaining
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
                  <h3 className="text-lg font-bold text-[var(--text)]">
                    Filter Chefs
                  </h3>
                  <button
                    onClick={() => setShowFilter(false)}
                    className="rounded-full p-2 transition-colors hover:bg-[var(--bg-2)]"
                  >
                    <X className="h-5 w-5 text-[var(--text-muted)]" />
                  </button>
                </div>

                <div className="mb-6">
                  <p className="mb-3 text-sm font-bold text-[var(--text)]">
                    Cuisine Type
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {CUISINES.map((c) => {
                      const selected = pendingFilters.cuisines.includes(c)
                      return (
                        <button
                          key={c}
                          onClick={() => toggleCuisine(c)}
                          className={`flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-semibold transition-all ${selected ? 'border-[var(--primary)] bg-[var(--primary)] text-white' : 'hover:border-[var(--primary)]/50 border-[var(--border)] bg-[var(--bg-2)] text-[var(--text-muted)]'}`}
                        >
                          {selected && <Check className="h-3 w-3" />}
                          {c}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="mb-6">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-sm font-bold text-[var(--text)]">
                      Max Price
                    </p>
                    <span className="text-sm font-bold text-[var(--primary)]">
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
                  <div className="mt-1 flex justify-between text-xs text-[var(--text-muted)]">
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
                    pendingFilters.priceMax < 50000) && (
                    <span className="ml-2 rounded-full bg-white/20 px-2 py-0.5 text-xs">
                      {pendingFilters.cuisines.length +
                        (pendingFilters.priceMax < 50000 ? 1 : 0)}{' '}
                      active
                    </span>
                  )}
                </Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Match Celebration */}
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
