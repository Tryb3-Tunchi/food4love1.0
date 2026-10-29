'use client'

import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/useAuthStore'
import { recordSwipe } from '@/services/swipes'

export interface SwipeCard {
  id: string
  role: 'cook' | 'buyer'
  kyc_status: 'unverified' | 'pending' | 'verified' | 'rejected'
  full_name: string
  bio: string | null
  avatar_url: string | null
  cuisines: string[]
  price_min: number | null
  price_max: number | null
  location: string | null
  rating: number | null
  photos: string[] | null
  daily_specials?: { title: string; price: number }[] | null
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
      if (!userId) return []

      const { data: swiped, error: swipedError } = await supabase
        .from('swipes')
        .select('swiped_id')
        .eq('swiper_id', userId)
      if (swipedError) throw swipedError

      const swipedIds = swiped?.map((s) => s.swiped_id) ?? []

      const { data: myProfile, error: profileError } = await supabase
        .from('profiles')
        .select('role, cuisines, price_max')
        .eq('id', userId)
        .single()
      if (profileError) throw profileError

      const isBuyer = myProfile?.role === 'buyer'

      let query = supabase
        .from('profiles')
        .select(
          'id, full_name, bio, avatar_url, role, kyc_status, is_verified, cuisines, price_min, price_max, location, rating, photos, lat, lng',
        )
        .eq('role', isBuyer ? 'cook' : 'buyer')
        .eq('onboarding_complete', true)
        .eq('suspended', false)

      query = query.neq('id', userId)

      if (swipedIds.length > 0) {
        query = query.not(
          'id',
          'in',
          `(${swipedIds.map((id) => `"${id}"`).join(',')})`,
        )
      }

      if (filters?.cuisines && filters.cuisines.length > 0) {
        query = query.overlaps('cuisines', filters.cuisines)
      }

      if (isBuyer && filters?.priceMax) {
        query = query.lte('price_min', filters.priceMax)
      }

      const { data, error: queryError } = await query.limit(20)

      if (queryError) {
        console.error('Swipe query error:', queryError)
        throw queryError
      }

      const cooks = data ?? []
      if (isBuyer && cooks.length > 0) {
        const cookIds = cooks.map((c) => c.id)
        const { data: specials } = await supabase
          .from('daily_specials')
          .select('cook_id, title, price')
          .in('cook_id', cookIds)
          .eq('moderation_status', 'active')
          .gte('available_until', new Date().toISOString())

        const specialsMap = new Map<
          string,
          { title: string; price: number }[]
        >()
        specials?.forEach((s) => {
          if (!specialsMap.has(s.cook_id)) specialsMap.set(s.cook_id, [])
          specialsMap.get(s.cook_id)!.push({ title: s.title, price: s.price })
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

  const swipeMutation = useMutation({
    mutationFn: async ({
      swipedUserId,
      action,
    }: {
      swipedUserId: string
      action: 'like' | 'pass' | 'superlike'
    }) => {
      if (!userId) throw new Error('Not authenticated')
      return recordSwipe(swipedUserId, action)
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['swipe-candidates'] })
      if (data.match) {
        window.dispatchEvent(
          new CustomEvent('food4love-match', {
            detail: { user: candidates[currentIndex] },
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
