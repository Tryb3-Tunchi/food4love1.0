'use client'

import { useState, useCallback, useEffect } from 'react'
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

  // Fetch candidates
  const {
    data: candidates = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['swipe-candidates', userId, filters],
    queryFn: async () => {
      if (!userId) return []

      // Get already swiped IDs
      const { data: swiped } = await supabase
        .from('swipes')
        .select('swiped_id')
        .eq('swiper_id', userId)

      const swipedIds = swiped?.map((s) => s.swiped_id) ?? []

      // Get current user's profile for filtering
      const { data: myProfile } = await supabase
        .from('profiles')
        .select('role, cuisines, price_max')
        .eq('id', userId)
        .single()

      const isBuyer = myProfile?.role === 'buyer'

      let query = supabase
        .from('profiles')
        .select(
          'id, full_name, bio, avatar_url, cuisines, price_min, price_max, location, rating, photos, lat, lng',
        )
        .eq('role', isBuyer ? 'cook' : 'buyer')
        .eq('is_active', true)

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

      const { data, error } = await query.limit(20)
      if (error) throw error

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
        swiped_user_id: swipedUserId,
        action,
      })
      if (error) throw error

      // Check for mutual like
      if (action === 'like' || action === 'superlike') {
        const { data: mutual } = await supabase
          .from('swipes')
          .select('id')
          .eq('swiper_id', swipedUserId)
          .eq('swiped_user_id', userId)
          .in('action', ['like', 'superlike'])
          .single()

        if (mutual) {
          // Create match
          const { error: matchError } = await supabase.from('matches').insert({
            user1_id: userId,
            user2_id: swipedUserId,
            status: 'active',
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
        // Match celebration will be handled by parent
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

      // Wait for animation
      await new Promise((resolve) => setTimeout(resolve, 300))

      swipeMutation.mutate(
        { swipedUserId: currentCard.id, action },
        {
          onSuccess: (data) => {
            setCurrentIndex((prev) => prev + 1)
            setDirection(null)
            if (data.match) {
              // Trigger match overlay in parent component
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
