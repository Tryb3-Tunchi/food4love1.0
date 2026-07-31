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
import { motion, AnimatePresence, useMotionValue, useTransform, PanInfo } from 'framer-motion'
import toast from 'react-hot-toast'

const CUISINES = [
  'Igbo Cuisine', 'Yoruba Cuisine', 'Hausa Cuisine', 'Jollof & Rice',
  'Nigerian BBQ', 'Soups & Stew', 'Swallow', 'Small Chops',
  'Seafood', 'Pastries', 'Continental', 'Suya & Grills',
]

interface Filters {
  cuisines: string[]
  priceMax: number
  distance: number
}

export default function SwipePage() {
  const profile = useAuthStore((s) => s.profile)

  const [deck, setDeck] = useState<Chef[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isAnimating, setIsAnimating] = useState(false)
  const [showMatch, setShowMatch] = useState(false)
  const [matchedChef, setMatchedChef] = useState<Chef | null>(null)

  const [showFilter, setShowFilter] = useState(false)
  const [filters, setFilters] = useState<Filters>({ cuisines: [], priceMax: 50000, distance: 20 })
  const [pendingFilters, setPendingFilters] = useState<Filters>({ cuisines: [], priceMax: 50000, distance: 20 })
  const activeFilters = filters.cuisines.length > 0 || filters.priceMax < 50000

  const { data, isLoading, refetch } = useSwipeDeck(
    activeFilters ? { cuisines: filters.cuisines, priceMax: filters.priceMax, distance: filters.distance } : undefined
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

  const handleSwipe = useCallback(async (action: 'like' | 'pass') => {
    if (!current || !profile || isAnimating) return

    setIsAnimating(true)

    // Wait for exit animation, then advance
    setTimeout(async () => {
      setCurrentIndex((prev) => prev + 1)
      setIsAnimating(false)

      // Record to DB
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
  }, [current, profile, isAnimating])

  const handleDragEnd = useCallback((_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (!current || !profile || isAnimating) return
    const threshold = 100

    if (info.offset.x > threshold) {
      handleSwipe('like')
    } else if (info.offset.x < -threshold) {
      handleSwipe('pass')
    }
  }, [current, profile, isAnimating, handleSwipe])

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
      cuisines: p.cuisines.includes(c) ? p.cuisines.filter((x) => x !== c) : [...p.cuisines, c],
    }))
  }

  return (
    <AppPage ambient="pepper" ambientIntensity="low" fullHeight className="relative overflow-hidden">
      {/* Inline background animations */}
      <style jsx global>{`
        @keyframes orb1 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(50px, -40px) scale(1.08); }
        }
        @keyframes orb2 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(-40px, 30px) scale(1.05); }
        }
        @keyframes orb3 {
          0%, 100% { transform: translate(0, 0); opacity: 0.5; }
          50% { transform: translate(30px, -20px); opacity: 1; }
        }
        @keyframes floatEmoji {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-25px) rotate(8deg); }
        }
      `}</style>

      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div
          className="absolute top-[-15%] left-[-15%] w-[600px] h-[600px] rounded-full bg-[#e85a2a] opacity-[0.12] blur-[120px]"
          style={{ animation: 'orb1 18s ease-in-out infinite' }}
        />
        <div
          className="absolute bottom-[-15%] right-[-15%] w-[500px] h-[500px] rounded-full bg-amber-400 opacity-[0.10] blur-[100px]"
          style={{ animation: 'orb2 22s ease-in-out infinite' }}
        />
        <div
          className="absolute top-[40%] left-[50%] w-[400px] h-[400px] rounded-full bg-green-400 opacity-[0.08] blur-[90px]"
          style={{ animation: 'orb3 14s ease-in-out infinite' }}
        />

        {['🍲', '🍛', '🥘', '🍗', '🌶️', '🥥'].map((emoji, i) => (
          <span
            key={i}
            className="absolute text-3xl select-none"
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
            backgroundSize: '30px 30px'
          }}
        />
      </div>

      {/* Header */}
      <div className="relative z-10 px-4 pt-4 pb-2 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Flame className="w-5 h-5 text-[var(--primary)]" />
          <h1 className="text-lg font-bold text-[var(--text)]">Discover</h1>
          {profile?.streak && profile.streak > 1 && (
            <span className="flex items-center gap-0.5 text-xs font-bold text-[var(--primary)] bg-[var(--primary)]/10 px-2 py-0.5 rounded-full">
              <Flame className="w-3 h-3" /> {profile.streak}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {activeFilters && (
            <button onClick={clearFilters} className="text-xs font-semibold text-[var(--primary)] bg-[var(--primary)]/10 px-3 py-1.5 rounded-full hover:bg-[var(--primary)]/20 transition-colors">
              Clear
            </button>
          )}
          <button
            onClick={() => { setPendingFilters(filters); setShowFilter(true) }}
            className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--card)] border border-[var(--border)] hover:border-[var(--primary)]/50 transition-colors active:scale-95"
          >
            <SlidersHorizontal className="h-4 w-4 text-[var(--text-muted)]" />
            {activeFilters && <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-[var(--primary)]" />}
          </button>
        </div>
      </div>

      {/* Card Area */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 min-h-0 py-4">
        {isLoading && deck.length === 0 ? (
          <div className="w-full max-w-sm aspect-[3/4] rounded-[32px] bg-[var(--card)] border border-[var(--border)] animate-pulse shadow-xl" />
        ) : !current ? (
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center justify-center gap-4 text-center px-6">
            <div className="text-6xl mb-2">🍽️</div>
            <h3 className="text-xl font-bold text-[var(--text)]">{activeFilters ? 'No chefs match filters' : "You've seen everyone!"}</h3>
            <p className="text-sm text-[var(--text-muted)] max-w-[240px]">{activeFilters ? 'Try broadening your search' : 'New chefs join daily. Check back soon!'}</p>
            <div className="flex gap-3 mt-2">
              {activeFilters && <Button onClick={clearFilters} variant="secondary" size="md" pill>Clear Filters</Button>}
              <Button onClick={() => { setDeck([]); setCurrentIndex(0); refetch(); }} variant="primary" size="md" pill>Refresh</Button>
            </div>
          </motion.div>
        ) : (
          <>
            {/* CARD WRAPPER — handles drag, stamps, and exit */}
            <div className="relative w-full max-w-sm aspect-[3/4] max-h-[65vh]">
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
                    x: isAnimating ? (dragX.get() > 0 ? 500 : -500) : 0,
                    opacity: 0,
                    rotate: isAnimating ? (dragX.get() > 0 ? 20 : -20) : 0,
                    transition: { duration: 0.4, ease: [0.32, 0.72, 0, 1] }
                  }}
                  transition={{ type: "spring", stiffness: 350, damping: 30 }}
                  className="absolute inset-0 touch-none"
                >
                  {/* LIKE / NOPE Stamps */}
                  <motion.div
                    style={{ opacity: opacityLike }}
                    className="absolute top-10 left-8 border-[3px] border-[#4ade80] text-[#4ade80] px-5 py-2 rounded-2xl font-black text-3xl tracking-[0.15em] uppercase -rotate-12 shadow-lg pointer-events-none z-20"
                  >
                    LIKE
                  </motion.div>
                  <motion.div
                    style={{ opacity: opacityPass }}
                    className="absolute top-10 right-8 border-[3px] border-[#ff4458] text-[#ff4458] px-5 py-2 rounded-2xl font-black text-3xl tracking-[0.15em] uppercase rotate-12 shadow-lg pointer-events-none z-20"
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

            <p className="mt-3 text-xs text-[var(--text-muted)] font-medium">
              {remaining} chef{remaining !== 1 ? 's' : ''} remaining
            </p>
          </>
        )}
      </div>

      {/* Filter Modal */}
      <AnimatePresence>
        {showFilter && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={() => setShowFilter(false)} />
            <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }} transition={{ type: "spring", damping: 25, stiffness: 300 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
              <div className="w-full max-w-sm bg-[var(--card)] border border-[var(--border)] rounded-3xl p-6 shadow-2xl pointer-events-auto max-h-[85vh] overflow-y-auto scrollbar-none" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-bold text-[var(--text)]">Filter Chefs</h3>
                  <button onClick={() => setShowFilter(false)} className="p-2 rounded-full hover:bg-[var(--bg-2)] transition-colors"><X className="w-5 h-5 text-[var(--text-muted)]" /></button>
                </div>

                <div className="mb-6">
                  <p className="text-sm font-bold text-[var(--text)] mb-3">Cuisine Type</p>
                  <div className="flex flex-wrap gap-2">
                    {CUISINES.map((c) => {
                      const selected = pendingFilters.cuisines.includes(c)
                      return (
                        <button key={c} onClick={() => toggleCuisine(c)} className={`flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold transition-all border ${selected ? 'bg-[var(--primary)] text-white border-[var(--primary)]' : 'bg-[var(--bg-2)] text-[var(--text-muted)] border-[var(--border)] hover:border-[var(--primary)]/50'}`}>
                          {selected && <Check className="h-3 w-3" />}
                          {c}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-bold text-[var(--text)]">Max Price</p>
                    <span className="text-sm font-bold text-[var(--primary)]">₦{pendingFilters.priceMax.toLocaleString()}</span>
                  </div>
                  <input type="range" min={2000} max={50000} step={1000} value={pendingFilters.priceMax} onChange={(e) => setPendingFilters((p) => ({ ...p, priceMax: Number(e.target.value) }))} className="w-full" />
                  <div className="flex justify-between mt-1 text-xs text-[var(--text-muted)]"><span>₦2,000</span><span>₦50,000</span></div>
                </div>

                <Button onClick={applyFilters} variant="primary" size="lg" fullWidth pill>
                  Apply Filters
                  {(pendingFilters.cuisines.length > 0 || pendingFilters.priceMax < 50000) && (
                    <span className="ml-2 rounded-full bg-white/20 px-2 py-0.5 text-xs">{pendingFilters.cuisines.length + (pendingFilters.priceMax < 50000 ? 1 : 0)} active</span>
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
        onClose={() => { setShowMatch(false); setMatchedChef(null) }}
      />
    </AppPage>
  )
}