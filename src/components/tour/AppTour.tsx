'use client'
import { useEffect, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/useAuthStore'
import { updateProfile } from '@/services/profiles'
import type { DriveStep, Driver } from 'driver.js'
import { usePwa } from '@/components/pwa/PwaProvider'

type TourSegment = {
  path: string
  steps: DriveStep[]
  nextPath?: string
}

export const TOUR_SEGMENT_KEY = 'food4love-tour-segment'

function installTourStep(
  instructions: string,
  requestInstall: () => Promise<void>,
): DriveStep {
  return {
    popover: {
      title: 'Take Food4Love Everywhere ❤️',
      description:
        'Install Food4Love on your home screen for quicker access and an app-like experience.',
      doneBtnText: 'Skip install',
      onPopoverRender: (popover) => {
        const platformHelp = document.createElement('p')
        platformHelp.className = 'f4l-tour-install-help'
        platformHelp.textContent = instructions
        const installButton = document.createElement('button')
        installButton.type = 'button'
        installButton.className = 'f4l-tour-install-button'
        installButton.textContent = 'Install App'
        installButton.addEventListener('click', () => {
          void requestInstall()
        })
        popover.description.append(platformHelp, installButton)
      },
    },
  }
}

function getSegments(
  role: 'cook' | 'buyer',
  installStep?: DriveStep,
): TourSegment[] {
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
          ...(installStep ? [installStep] : []),
        ],
      },
    ]
  }

  return [
    { path: '/swipe', steps: discoverySteps, nextPath: '/stories' },
    {
      path: '/stories',
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
      nextPath: '/chat',
    },
    {
      path: '/chat',
      steps: [
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
        ...(installStep ? [installStep] : []),
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
  const pwa = usePwa()
  const pwaRef = useRef(pwa)
  pwaRef.current = pwa

  useEffect(() => {
    if (
      !pwa.ready ||
      isLoading ||
      !profile ||
      profile.tour_completed ||
      !pathname
    )
      return

    const role = profile.role
    const currentPwa = pwaRef.current
    const pwaStep = currentPwa.installed
      ? undefined
      : installTourStep(
          currentPwa.installInstructions,
          currentPwa.requestInstall,
        )
    const segments = getSegments(role, pwaStep)
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
                ? 'Next, take a look at your story tools.'
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
    profile,
    router,
    updateStore,
    pwa.ready,
  ])

  return null
}
