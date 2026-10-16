'use client'

import { useEffect } from 'react'
import { driver } from 'driver.js'
import 'driver.js/dist/driver.css'
import { createClient } from '@/lib/supabase/client'

type OnboardingTourProps = {
  userId: string
  role: 'cook' | 'buyer'
  tourCompleted: boolean
}

export default function OnboardingTour({
  userId,
  role,
  tourCompleted,
}: OnboardingTourProps) {
  useEffect(() => {
    if (tourCompleted || !userId) return

    const supabase = createClient()
    let disposed = false
    let tourStarted = false

    const steps =
      role === 'cook'
        ? [
            {
              element: '[data-tour="profile"]',
              popover: {
                title: 'Build your chef profile',
                description:
                  'Introduce yourself, your cooking style, and your specialties.',
              },
            },
            {
              element: '[data-tour="stories"]',
              popover: {
                title: "Share what you're cooking",
                description:
                  'Post food stories and save your best ones to your permanent posts.',
              },
            },
            {
              element: '[data-tour="specials"]',
              popover: {
                title: 'Showcase your daily specials',
                description: 'Highlight dishes you want people to discover.',
              },
            },
            {
              element: '[data-tour="discover"]',
              popover: {
                title: 'Meet your audience',
                description:
                  'Explore the discovery experience and connect with interested users.',
              },
            },
          ]
        : [
            {
              element: '[data-tour="discover"]',
              popover: {
                title: 'Discover your next favourite chef',
                description:
                  'Browse chef profiles and find food that fits your taste.',
              },
            },
            {
              element: '[data-tour="swipe-actions"]',
              popover: {
                title: 'Swipe to connect',
                description:
                  'Like the chefs you are interested in and pass on others.',
              },
            },
            {
              element: '[data-tour="matches"]',
              popover: {
                title: 'Find your connections',
                description:
                  'Return here to see your matches and continue conversations.',
              },
            },
            {
              element: '[data-tour="profile"]',
              popover: {
                title: 'Make it yours',
                description: 'Update your profile and food preferences.',
              },
            },
          ]

    const tour = driver({
      showProgress: true,
      allowClose: true,
      steps,
      onDestroyStarted: () => {
        // Persist completion only after the tour is actually started.
        void supabase
          .from('profiles')
          .update({ tour_completed: true })
          .eq('id', userId)
          .then(({ error }) => {
            if (error) console.error('Tour progress save failed', error)
          })

        tour.destroy()
      },
    })

    const startTimer = window.setTimeout(() => {
      if (disposed || tourStarted) return

      // Avoid starting over an unfinished initial page load.
      const firstStep = document.querySelector(steps[0].element as string)

      if (!firstStep) return

      tourStarted = true
      tour.drive()
    }, 900)

    return () => {
      disposed = true
      window.clearTimeout(startTimer)
      tour.destroy()
    }
  }, [userId, role, tourCompleted])

  return null
}
