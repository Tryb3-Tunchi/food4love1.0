'use client'
import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { useAuthStore } from '@/stores/useAuthStore'
import { updateProfile } from '@/services/profiles'

export function AppTour() {
  const pathname = usePathname()
  const profile = useAuthStore((s) => s.profile)
  const updateStore = useAuthStore((s) => s.updateProfile)
  const isTourRoute =
    pathname === '/swipe' ||
    pathname === '/matches' ||
    pathname === '/chat' ||
    pathname.startsWith('/chat/')

  useEffect(() => {
    if (!profile || profile.tour_completed || !isTourRoute) return
    let driver: any
    const init = async () => {
      const { driver: driverFn } = await import('driver.js')
      await import('driver.js/dist/driver.css')
      driver = driverFn({
        animate: true,
        smoothScroll: true,
        allowClose: true,
        overlayColor: 'rgba(15,10,5,0.85)',
        stagePadding: 8,
        popoverClass: 'food4love-tour',
        doneBtnText: "Let's eat! 🍽️",
        nextBtnText: 'Next →',
        prevBtnText: '← Back',
        onDestroyStarted: async () => {
          driver.destroy()
          updateStore({ tour_completed: true })
          await updateProfile(profile.id, { tour_completed: true })
        },
      })
      driver.setSteps([
        {
          popover: {
            title: '👆 Swipe to Discover',
            description:
              'Drag the card right to like a chef, left to pass. Or use the buttons below.',
            side: 'bottom',
          },
        },
        {
          element: '#stories-strip',
          popover: {
            title: '🍳 Chef Stories',
            description:
              'Tap to see what chefs are cooking TODAY — live and fresh.',
            side: 'bottom',
          },
        },
        {
          element: '#filter-btn',
          popover: {
            title: '🎛 Filter Your Feed',
            description:
              'Set your budget, cuisine type, and how far you want to travel.',
            side: 'bottom',
          },
        },
        {
          element: '#bottom-nav-matches',
          popover: {
            title: '❤️ Your Matches',
            description:
              "When a chef likes you back it's a match! You have 24 hours to say hi.",
            side: 'top',
          },
        },
        {
          element: '#bottom-nav-chat',
          popover: {
            title: '💬 Chat & Book',
            description:
              'Chat with your matches and book a meal directly from the conversation.',
            side: 'top',
          },
        },
      ])
      setTimeout(() => driver.drive(), 1500)
    }
    init()
    return () => {
      driver?.destroy()
    }
  }, [isTourRoute, profile?.id, profile?.tour_completed, updateStore, profile])

  return null
}
