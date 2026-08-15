'use client'

import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/useAuthStore'

export interface SwipeCard {
  id: string
  full_name: string
  bio: string | null
  avatar_url: string | null
  cuisines: string[]
  price_min: number | null
  price_max: number | null
  location: string | null
  rating: number | null
  photos: string[] | null
  daily_specials: { title: string; price: number }[] | null
  lat: number | null
  lng: number | null
}

export function useSwipeDeck(filters?: {
  cuisines?: string[]
  priceMax?: number
  distance?: number
}) {
  const supabase = createClient()
  const profile = useAuthStore((s) => s.profile)
  const userId = profile?.id
  const queryClient = useQueryClient()

  const [currentIndex, setCurrentIndex] = useState(0)
  const [direction, setDirection] = useState<'left' | 'right' | 'up' | null>(
    null,
  )

  const {
    data: candidates = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['swipe-candidates', userId, filters],
    queryFn: async () => {
      console.log('🔍 [useSwipeDeck] Starting fetch...')
      console.log('🔍 [useSwipeDeck] userId:', userId)

      if (!userId) {
        console.warn('⚠️ [useSwipeDeck] No userId — returning empty')
        return []
      }

      // Get already swiped IDs
      const { data: swiped, error: swipedErr } = await supabase
        .from('swipes')
        .select('swiped_id')
        .eq('swiper_id', userId)

      if (swipedErr) {
        console.error('❌ [useSwipeDeck] Swipes query error:', swipedErr)
      }

      const swipedIds = swiped?.map((s) => s.swiped_id) ?? []
      console.log('🔍 [useSwipeDeck] Already swiped:', swipedIds)

      // Get current user's profile for filtering
      const { data: myProfile, error: profileErr } = await supabase
        .from('profiles')
        .select('role, cuisines, price_max')
        .eq('id', userId)
        .single()

      if (profileErr) {
        console.error('❌ [useSwipeDeck] Profile fetch error:', profileErr)
      }

      console.log('🔍 [useSwipeDeck] My profile:', myProfile)

      const isBuyer = myProfile?.role === 'buyer'
      console.log('🔍 [useSwipeDeck] isBuyer:', isBuyer)

      let query = supabase
        .from('profiles')
        .select(
          'id, full_name, bio, avatar_url, cuisines, price_min, price_max, location, rating, photos, lat, lng',
        )
        .eq('role', isBuyer ? 'cook' : 'buyer')
        .eq('suspended', false)

      if (swipedIds.length > 0) {
        query = query.not('id', 'in', `(${[userId, ...swipedIds].join(',')})`)
      } else {
        query = query.neq('id', userId)
      }

      if (filters?.cuisines && filters.cuisines.length > 0) {
        query = query.contains('cuisines', filters.cuisines)
      }

      if (filters?.priceMax) {
        query = query.lte('price_min', filters.priceMax)
      }

      if (isBuyer) {
        query = query.eq('kyc_status', 'verified')
      }

      const { data, error: queryError } = await query.limit(20)

      if (queryError) {
        console.error('❌ [useSwipeDeck] MAIN QUERY ERROR:', queryError)
        throw queryError
      }

      console.log(
        '✅ [useSwipeDeck] Raw results:',
        data?.length ?? 0,
        'profiles',
      )
      console.log('✅ [useSwipeDeck] Results:', data)

      // Enrich with daily specials
      const cooks = data ?? []
      if (isBuyer && cooks.length > 0) {
        const cookIds = cooks.map((c) => c.id)
        const { data: specials } = await supabase
          .from('daily_specials')
          .select('cook_id, title, price')
          .in('cook_id', cookIds)
          .gte('available_until', new Date().toISOString())

        const specialsMap = new Map()
        specials?.forEach((s) => {
          if (!specialsMap.has(s.cook_id)) specialsMap.set(s.cook_id, [])
          specialsMap.get(s.cook_id).push({ title: s.title, price: s.price })
        })

        return cooks.map((c) => ({
          ...c,
          daily_specials: specialsMap.get(c.id) ?? null,
        })) as SwipeCard[]
      }

      return cooks as SwipeCard[]
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 5,
  })

  // Log errors at hook level too
  if (error) {
    console.error('❌ [useSwipeDeck] useQuery error:', error)
  }

  // Swipe mutation
  const swipeMutation = useMutation({
    mutationFn: async ({
      swipedUserId,
      action,
    }: {
      swipedUserId: string
      action: 'like' | 'pass' | 'superlike'
    }) => {
      const { error } = await supabase.from('swipes').insert({
        swiper_id: userId,
        swiped_id: swipedUserId,
        action,
      })
      if (error) throw error

      // Check for mutual like
      if (action === 'like' || action === 'superlike') {
        const { data: mutual } = await supabase
          .from('swipes')
          .select('id')
          .eq('swiper_id', swipedUserId)
          .eq('swiped_id', userId) // ← FIXED: was swiped_user_id
          .in('action', ['like', 'superlike'])
          .single()

        if (mutual) {
          const { error: matchError } = await supabase.from('matches').insert({
            user1_id: userId,
            user2_id: swipedUserId,
            status: 'matched',
            expires_at: new Date(
              Date.now() + 24 * 60 * 60 * 1000,
            ).toISOString(),
          })
          if (matchError) throw matchError
          return { match: true }
        }
      }
      return { match: false }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['swipe-candidates'] })
      if (data.match) {
        window.dispatchEvent(
          new CustomEvent('food4love-match', {
            detail: { user: currentCard },
          }),
        )
      }
    },
  })

  const currentCard = candidates[currentIndex]
  const hasMore = currentIndex < candidates.length

  const handleSwipe = useCallback(
    async (action: 'like' | 'pass' | 'superlike') => {
      if (!currentCard || swipeMutation.isPending) return

      setDirection(
        action === 'pass' ? 'left' : action === 'superlike' ? 'up' : 'right',
      )

      await new Promise((resolve) => setTimeout(resolve, 300))

      swipeMutation.mutate(
        { swipedUserId: currentCard.id, action },
        {
          onSuccess: (data) => {
            setCurrentIndex((prev) => prev + 1)
            setDirection(null)
            if (data.match) {
              window.dispatchEvent(
                new CustomEvent('food4love-match', {
                  detail: { user: currentCard },
                }),
              )
            }
          },
          onError: () => {
            setDirection(null)
          },
        },
      )
    },
    [currentCard, swipeMutation],
  )

  const handleDragEnd = useCallback(
    (velocityX: number, velocityY: number, offsetX: number) => {
      const threshold = 100
      const velocityThreshold = 0.5

      if (offsetX > threshold || velocityX > velocityThreshold) {
        handleSwipe('like')
      } else if (offsetX < -threshold || velocityX < -velocityThreshold) {
        handleSwipe('pass')
      } else if (velocityY < -velocityThreshold) {
        handleSwipe('superlike')
      }
    },
    [handleSwipe],
  )

  const refresh = useCallback(() => {
    setCurrentIndex(0)
    setDirection(null)
    queryClient.invalidateQueries({ queryKey: ['swipe-candidates'] })
  }, [queryClient])

  return {
    cards: candidates,
    data: candidates,
    currentCard,
    currentIndex,
    hasMore,
    isLoading,
    error,
    direction,
    handleSwipe,
    handleDragEnd,
    swipeMutation,
    refresh,
    refetch: refresh,
  }
}
