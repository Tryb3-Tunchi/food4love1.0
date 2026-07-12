'use client'

import { useLayoutEffect, useRef, type ReactNode } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

type MarketingMotionShellProps = {
  children: ReactNode
}

export function MarketingMotionShell({ children }: MarketingMotionShellProps) {
  const scopeRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (!scopeRef.current) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const ctx = gsap.context(() => {
      const groups = gsap.utils.toArray<HTMLElement>('[data-gsap="card-group"]')

      groups.forEach((group) => {
        const cards = group.querySelectorAll<HTMLElement>(
          '[data-gsap="micro-card"]',
        )

        if (!cards.length) return

        gsap.fromTo(
          cards,
          {
            autoAlpha: 0,
            y: 15,
          },
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.72,
            stagger: 0.12,
            ease: 'power2.out',
            scrollTrigger: {
              trigger: group,
              start: 'top 82%',
              once: true,
            },
          },
        )
      })

      const headings = gsap.utils.toArray<HTMLElement>(
        '[data-gsap="heading-reveal"]',
      )

      headings.forEach((heading) => {
        gsap.fromTo(
          heading,
          {
            autoAlpha: 0,
            y: 24,
            clipPath: 'inset(0 0 100% 0)',
          },
          {
            autoAlpha: 1,
            y: 0,
            clipPath: 'inset(0 0 0% 0)',
            duration: 0.9,
            ease: 'power2.out',
            scrollTrigger: {
              trigger: heading,
              start: 'top 86%',
              once: true,
            },
          },
        )
      })

      const heroPlate = scopeRef.current?.querySelector<HTMLElement>(
        '[data-gsap="hero-plate"]',
      )

      if (heroPlate) {
        gsap.fromTo(
          heroPlate,
          { rotate: -8 },
          {
            rotate: 16,
            ease: 'none',
            scrollTrigger: {
              trigger: heroPlate,
              start: 'top bottom',
              end: 'bottom top',
              scrub: 1,
            },
          },
        )
      }
    }, scopeRef)

    return () => ctx.revert()
  }, [])

  return (
    <div ref={scopeRef} className="contents">
      {children}
    </div>
  )
}
