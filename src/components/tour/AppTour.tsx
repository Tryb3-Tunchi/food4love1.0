'use client'
import { useEffect, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/useAuthStore'
import { updateProfile } from '@/services/profiles'
import type { DriveStep, Driver } from 'driver.js'

type TourSegment = {
  path: string
  steps: DriveStep[]
  nextPath?: string
}

export const TOUR_SEGMENT_KEY = 'food4love-tour-segment'

function getSegments(role: 'cook' | 'buyer'): TourSegment[] {
  const discoverySteps: DriveStep[] = [
    {
      element: '[data-tour="discovery"]',
      popover: {
        title: 'Discover home cooks',
        description:
          'Explore profiles from cooks and find food that fits your taste.',
        side: 'bottom',
      },
    },
    {
      element: '[data-tour="swipe-actions"]',
      popover: {
        title: 'Choose who to connect with',
        description:
          'Pass, like, or superlike with the controls below each profile.',
        side: 'top',
      },
    },
    {
      element: '[data-tour="filter"]',
      popover: {
        title: 'Tune your discovery feed',
        description: 'Filter cooks by cuisine and price range.',
        side: 'bottom',
      },
    },
  ]

  if (role === 'buyer') {
    return [
      { path: '/swipe', steps: discoverySteps, nextPath: '/matches' },
      {
        path: '/matches',
        steps: [
          {
            element: '[data-tour="matches-content"]',
            popover: {
              title: 'Your matches',
              description:
                'Mutual likes appear here. Open a match to continue in chat.',
              side: 'bottom',
            },
          },
          {
            element: '[data-tour="nav-chat"]',
            popover: {
              title: 'Conversations',
              description:
                'Continue conversations and coordinate a meal with your matches.',
              side: 'top',
            },
          },
        ],
        nextPath: '/profile',
      },
      {
        path: '/profile',
        steps: [
          {
            element: '[data-tour="profile-summary"]',
            popover: {
              title: 'Set up your profile',
              description:
                'Keep your name, location, and food preferences up to date.',
              side: 'bottom',
            },
          },
          {
            element: '[data-tour="profile-edit"]',
            popover: {
              title: 'Edit your details',
              description:
                'Use this control to update your profile information.',
              side: 'bottom',
            },
          },
        ],
      },
    ]
  }

  return [
    { path: '/swipe', steps: discoverySteps, nextPath: '/requests' },
    {
      path: '/requests',
      steps: [
        {
          element: '[data-tour="story-management"]',
          popover: {
            title: 'Manage your stories',
            description:
              'Stories expire after 24 hours; save a story to keep its media and caption as a permanent post.',
            side: 'bottom',
          },
        },
        {
          element: '[data-tour="story-create"]',
          popover: {
            title: 'Share a new story',
            description:
              'Post a short video from your kitchen for buyers to discover.',
            side: 'left',
          },
        },
      ],
      nextPath: '/matches',
    },
    {
      path: '/matches',
      steps: [
        {
          element: '[data-tour="matches-content"]',
          popover: {
            title: 'Your matches',
            description:
              'See your connections and open a conversation to plan a meal.',
            side: 'bottom',
          },
        },
        {
          element: '[data-tour="nav-chat"]',
          popover: {
            title: 'Chat with connections',
            description: 'Keep conversations with buyers in one place.',
            side: 'top',
          },
        },
      ],
      nextPath: '/profile',
    },
    {
      path: '/profile',
      steps: [
        {
          element: '[data-tour="profile-summary"]',
          popover: {
            title: 'Your chef profile',
            description:
              'Keep your introduction and specialties current so buyers know what you cook.',
            side: 'bottom',
          },
        },
        {
          element: '[data-tour="profile-posts-tab"]',
          popover: {
            title: 'Permanent posts',
            description:
              'Saved stories remain here after their 24-hour story window ends.',
            side: 'bottom',
          },
        },
        {
          element: '[data-tour="profile-specials-tab"]',
          popover: {
            title: 'Manage daily specials',
            description: 'Show buyers the dishes you are offering today.',
            side: 'bottom',
          },
        },
      ],
    },
  ]
}

export function AppTour() {
  const pathname = usePathname()
  const router = useRouter()
  const profile = useAuthStore((s) => s.profile)
  const isLoading = useAuthStore((s) => s.loading)
  const updateStore = useAuthStore((s) => s.updateProfile)
  const transitioning = useRef(false)

  useEffect(() => {
    if (isLoading || !profile || profile.tour_completed || !pathname) return

    const role = profile.role
    const segments = getSegments(role)
    const storedSegment = window.sessionStorage.getItem(TOUR_SEGMENT_KEY)
    const segmentIndex = storedSegment === null ? 0 : Number(storedSegment)
    const segment = segments[segmentIndex]
    if (!segment || pathname !== segment.path) return

    let tour: Driver | undefined
    let startTimer = 0
    let disposed = false

    const start = async () => {
      const { driver: createDriver } = await import('driver.js')
      await import('driver.js/dist/driver.css')
      if (disposed) return

      const availableSteps = segment.steps.filter((step) => {
        if (!step.element || typeof step.element !== 'string') return true
        return document.querySelector(step.element) !== null
      })

      if (segment.nextPath) {
        availableSteps.push({
          popover: {
            title: 'Next up',
            description:
              role === 'cook' && segment.path === '/swipe'
                ? 'Next, take a look at your incoming requests and story tools.'
                : 'Continue to the next part of your Food4Love tour.',
            nextBtnText: 'Continue',
            onNextClick: () => {
              transitioning.current = true
              window.sessionStorage.setItem(
                TOUR_SEGMENT_KEY,
                String(segmentIndex + 1),
              )
              tour?.destroy()
              router.push(segment.nextPath!)
            },
          },
        })
      }

      if (availableSteps.length === 0) return

      tour = createDriver({
        animate: !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
        smoothScroll: true,
        allowClose: true,
        skipMissingElement: true,
        overlayColor: 'rgba(15,10,5,0.85)',
        stagePadding: 8,
        popoverClass: 'food4love-tour',
        showProgress: true,
        doneBtnText: "Let's eat!",
        nextBtnText: 'Next',
        prevBtnText: 'Back',
        onDestroyStarted: () => {
          if (transitioning.current || disposed) return
          window.sessionStorage.removeItem(TOUR_SEGMENT_KEY)
          updateStore({ tour_completed: true })
          void updateProfile(profile.id, { tour_completed: true }).catch(
            (error) => {
              updateStore({ tour_completed: false })
              console.error('Could not save tour completion', error)
            },
          )
          tour?.destroy()
        },
      })
      tour.setSteps(availableSteps)
      tour.drive()
    }

    const waitForContent = () => {
      const readinessSelector =
        segment.path === '/swipe'
          ? '[data-tour="discovery-ready"]'
          : (segment.steps.find((step) => typeof step.element === 'string')
              ?.element as string | undefined)

      if (!readinessSelector || document.querySelector(readinessSelector)) {
        start().catch((error) => console.error('Could not start tour', error))
        return
      }
      startTimer = window.setTimeout(waitForContent, 250)
    }

    const initialTimer = window.setTimeout(waitForContent, 350)
    return () => {
      disposed = true
      transitioning.current = false
      window.clearTimeout(initialTimer)
      window.clearTimeout(startTimer)
      tour?.destroy()
    }
  }, [
    isLoading,
    pathname,
    profile?.id,
    profile?.role,
    profile?.tour_completed,
    router,
    updateStore,
  ])

  return null
}
