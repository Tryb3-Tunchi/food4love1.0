'use client'
import { useState, useEffect } from 'react'
import { useSwipeDeck } from '@/hooks/useSwipeDeck'
import { useAuthStore } from '@/stores/useAuthStore'
import { useSwipeStore } from '@/stores/useSwipeStore'
import { SwipeCard } from '@/components/swipe/SwipeCard'
import { SwipeActions } from '@/components/swipe/SwipeActions'
import { MatchCelebration } from '@/components/swipe/MatchCelebration'
import { CardSkeleton } from '@/components/ui/Skeleton'
import { AppPage } from '@/components/ui/AppPage'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { recordSwipe, checkMutualLike } from '@/services/swipes'
import { createMatch } from '@/services/matches'
import { SlidersHorizontal, Flame, X, Check } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { SwipeAmbientParticles } from '@/components/swipe/SwipeAmbientParticles'

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
  'Cross River Cuisine',
]

interface Filters {
  cuisines: string[]
  priceMax: number
  distance: number
}

export default function SwipePage() {
  const profile = useAuthStore((s) => s.profile)
  const {
    deck,
    currentIndex,
    nextCard,
    setMatch,
    showMatchCelebration,
    matchedProfile,
    clearMatch,
  } = useSwipeStore()

  const [matchId, setMatchId] = useState<string>()
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

  // 1. Fetching hook driven smoothly by the committed filter state variables
  const { data, isLoading, refetch } = useSwipeDeck(
    activeFilters
      ? {
          cuisines: filters.cuisines,
          priceMax: filters.priceMax,
          distance: filters.distance,
        }
      : undefined,
  )

  // 2. FIXED: Safe store hydration inside useEffect to prevent infinite rendering cycles
  useEffect(() => {
    if (data && deck.length === 0) {
      useSwipeStore.getState().setDeck(data)
    }
  }, [data, deck.length])

  const current = deck[currentIndex]
  const next = deck[currentIndex + 1]

  const handleSwipe = async (action: 'like' | 'pass') => {
    if (!profile || !current) return
    nextCard()
    if (action === 'like') {
      try {
        await recordSwipe(profile.id, current.id, 'like')
        const mutual = await checkMutualLike(profile.id, current.id)
        if (mutual) {
          const m = await createMatch(profile.id, current.id)
          setMatchId(m.id)
          setMatch(current)
        }
      } catch {
        toast.error('Something went wrong')
      }
    } else {
      await recordSwipe(profile.id, current.id, 'pass').catch(() => {})
    }
  }

  const applyFilters = () => {
    setFilters(pendingFilters)
    useSwipeStore.getState().setDeck([])
    setShowFilter(false)
  }

  const clearFilters = () => {
    const reset = { cuisines: [], priceMax: 50000, distance: 20 }
    setFilters(reset)
    setPendingFilters(reset)
    useSwipeStore.getState().setDeck([])
  }

  const toggleCuisine = (c: string) => {
    setPendingFilters((p) => ({
      ...p,
      cuisines: p.cuisines.includes(c)
        ? p.cuisines.filter((x) => x !== c)
        : [...p.cuisines, c],
    }))
  }

  if (isLoading)
    return (
      <AppPage
        ambient="pepper"
        ambientIntensity="low"
        fullHeight
        className="px-4 pt-6"
      >
        <SwipeAmbientParticles />
        <PageHeader title="Discover" icon={Flame} />
        <CardSkeleton />
      </AppPage>
    )

  return (
    <AppPage
      ambient="pepper"
      ambientIntensity="low"
      fullHeight
      className="px-4 pb-24 pt-5"
    >
      <PageHeader
        title="Discover"
        icon={Flame}
        badge={
          profile?.streak && profile.streak > 1
            ? `🔥 ${profile.streak}`
            : undefined
        }
        badgeColor="var(--accent-alt)"
        right={
          <div className="flex items-center gap-2">
            {activeFilters && (
              <button
                onClick={clearFilters}
                className="rounded-full px-3 py-1.5 text-xs font-semibold transition-all"
                style={{
                  background: 'var(--accent-soft)',
                  color: 'var(--accent)',
                }}
              >
                Clear filters
              </button>
            )}
            <button
              id="filter-btn"
              onClick={() => {
                setPendingFilters(filters)
                setShowFilter(true)
              }}
              className="relative flex h-9 w-9 items-center justify-center rounded-xl transition-all active:scale-95"
              style={{
                background: activeFilters
                  ? 'var(--accent-soft)'
                  : 'var(--card)',
                border: `1px solid ${activeFilters ? 'var(--accent)' : 'var(--border)'}`,
              }}
            >
              <SlidersHorizontal
                className="h-4 w-4"
                style={{
                  color: activeFilters ? 'var(--accent)' : 'var(--text-3)',
                }}
              />
              {activeFilters && (
                <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-[color:var(--accent)]" />
              )}
            </button>
          </div>
        }
      />

      {/* Card stack */}
      <div
        id="swipe-card-area"
        className="relative mx-auto w-full max-w-sm flex-1"
      >
        {!current ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex h-full flex-col items-center justify-center gap-5 text-center"
          >
            <motion.div
              animate={{ rotate: [0, -8, 8, 0] }}
              transition={{ duration: 2.5, repeat: Infinity, repeatDelay: 2 }}
              className="text-7xl"
            >
              🍽️
            </motion.div>
            <div>
              <h3
                className="mb-2 text-xl font-bold"
                style={{ color: 'var(--text-1)' }}
              >
                {activeFilters
                  ? 'No chefs match your filters'
                  : "You've seen everyone!"}
              </h3>
              <p className="text-sm" style={{ color: 'var(--text-3)' }}>
                {activeFilters
                  ? 'Try broadening your search'
                  : 'New chefs join every day. Check back soon.'}
              </p>
            </div>
            <div className="flex gap-2">
              {activeFilters && (
                <Button
                  onClick={clearFilters}
                  variant="secondary"
                  size="md"
                  pill
                >
                  Clear filters
                </Button>
              )}
              <Button
                onClick={() => refetch()}
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
            {next && (
              <SwipeCard
                key={`bg-${next.id}`}
                chef={next}
                onLike={() => {}}
                onPass={() => {}}
                onInfo={() => {}}
                isTop={false}
              />
            )}
            <SwipeCard
              key={`top-${current.id}`}
              chef={current}
              onLike={() => handleSwipe('like')}
              onPass={() => handleSwipe('pass')}
              onInfo={() => {}}
              isTop
            />
          </>
        )}
      </div>

      {/* Swipe actions */}
      {current && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="shrink-0 pb-2 pt-4"
        >
          <SwipeActions
            onPass={() => handleSwipe('pass')}
            onLike={() => handleSwipe('like')}
          />
        </motion.div>
      )}

      {/* Filter bottom sheet */}
      <AnimatePresence>
        {showFilter && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40"
              style={{
                background: 'rgba(0,0,0,0.4)',
                backdropFilter: 'blur(4px)',
              }}
              onClick={() => setShowFilter(false)}
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 z-50 mx-auto max-w-lg overflow-hidden rounded-t-3xl"
              style={{
                background: 'var(--bg-2)',
                borderTop: '1px solid var(--border)',
              }}
            >
              <div className="flex justify-center pb-1 pt-3">
                <div
                  className="h-1 w-10 rounded-full"
                  style={{ background: 'var(--border)' }}
                />
              </div>

              <div className="max-h-[80vh] overflow-y-auto px-5 pb-6">
                <div className="flex items-center justify-between py-4">
                  <h3
                    className="text-base font-bold"
                    style={{ color: 'var(--text-1)' }}
                  >
                    Filter Chefs
                  </h3>
                  <button onClick={() => setShowFilter(false)}>
                    <X className="h-5 w-5" style={{ color: 'var(--text-3)' }} />
                  </button>
                </div>

                {/* Cuisines */}
                <div className="mb-6">
                  <p
                    className="mb-3 text-sm font-semibold"
                    style={{ color: 'var(--text-1)' }}
                  >
                    Cuisine type
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {CUISINES.map((c) => {
                      const selected = pendingFilters.cuisines.includes(c)
                      return (
                        <button
                          key={c}
                          onClick={() => toggleCuisine(c)}
                          className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all"
                          style={{
                            // FIXED: Using tokens instead of hardcoded hex values
                            background: selected
                              ? 'var(--accent)'
                              : 'var(--bg-3)',
                            color: selected ? 'white' : 'var(--text-2)',
                            border: `1px solid ${selected ? 'var(--accent)' : 'var(--border)'}`,
                          }}
                        >
                          {selected && <Check className="h-3 w-3" />}
                          {c}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Max price */}
                <div className="mb-6">
                  <div className="mb-3 flex items-center justify-between">
                    <p
                      className="text-sm font-semibold"
                      style={{ color: 'var(--text-1)' }}
                    >
                      Max price per meal
                    </p>
                    <span
                      className="text-sm font-bold"
                      style={{ color: 'var(--accent)' }}
                    >
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
                    className="w-full accent-[color:var(--accent)]"
                  />
                  <div
                    className="mt-1 flex justify-between text-xs"
                    style={{ color: 'var(--text-3)' }}
                  >
                    <span>₦2,000</span>
                    <span>₦50,000</span>
                  </div>
                </div>

                {/* Apply */}
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

      {/* Match celebration */}
      {profile && (
        <MatchCelebration
          isOpen={showMatchCelebration}
          matchedChef={matchedProfile}
          currentUser={profile}
          matchId={matchId}
          onClose={clearMatch}
        />
      )}
    </AppPage>
  )
}
