'use client'

import { motion } from 'framer-motion'
import { ReactNode } from 'react'

interface Props {
  children?: ReactNode
  variant?: 'pepper' | 'ember' | 'green' | 'mixed'
  intensity?: 'low' | 'medium' | 'high'
}

const configs = {
  pepper: [
    {
      color: '232,57,14',
      size: 500,
      top: '-10%',
      right: '-5%',
      bottom: undefined,
      left: undefined,
      delay: 0,
      dur: 9,
    },
    {
      color: '232,57,14',
      size: 350,
      top: undefined,
      right: undefined,
      bottom: '10%',
      left: '-8%',
      delay: 2,
      dur: 11,
    },
    {
      color: '245,158,11',
      size: 280,
      top: '40%',
      right: '20%',
      bottom: undefined,
      left: undefined,
      delay: 4,
      dur: 8,
    },
  ],
  ember: [
    {
      color: '245,158,11',
      size: 450,
      top: '-5%',
      right: undefined,
      bottom: undefined,
      left: '10%',
      delay: 0,
      dur: 10,
    },
    {
      color: '232,57,14',
      size: 300,
      top: undefined,
      right: '5%',
      bottom: '5%',
      left: undefined,
      delay: 3,
      dur: 8,
    },
  ],
  green: [
    {
      color: '45,106,79',
      size: 400,
      top: '0%',
      right: '-10%',
      bottom: undefined,
      left: undefined,
      delay: 0,
      dur: 9,
    },
    {
      color: '82,183,136',
      size: 300,
      top: undefined,
      right: undefined,
      bottom: '0%',
      left: '-5%',
      delay: 2,
      dur: 12,
    },
    {
      color: '232,57,14',
      size: 200,
      top: '50%',
      right: '30%',
      bottom: undefined,
      left: undefined,
      delay: 5,
      dur: 7,
    },
  ],
  mixed: [
    {
      color: '232,57,14',
      size: 420,
      top: '-15%',
      right: '-5%',
      bottom: undefined,
      left: undefined,
      delay: 0,
      dur: 9,
    },
    {
      color: '245,158,11',
      size: 320,
      top: undefined,
      right: undefined,
      bottom: '5%',
      left: '-5%',
      delay: 2.5,
      dur: 11,
    },
    {
      color: '45,106,79',
      size: 260,
      top: '45%',
      right: '15%',
      bottom: undefined,
      left: undefined,
      delay: 5,
      dur: 8,
    },
    {
      color: '232,57,14',
      size: 200,
      top: undefined,
      right: undefined,
      bottom: '30%',
      left: '25%',
      delay: 7,
      dur: 10,
    },
  ],
}

const opacities = { low: 0.05, medium: 0.08, high: 0.13 }

export function AmbientBackground({
  children,
  variant = 'mixed',
  intensity = 'medium',
}: Props) {
  const orbs = configs[variant]
  const op = opacities[intensity]

  return (
    <div className="relative isolate min-h-screen">
      {/* Background layer */}
      <div
        className="ambient-bg pointer-events-none fixed inset-0 -z-10"
        aria-hidden="true"
      >
        {orbs.map((orb, i) => (
          <motion.div
            key={i}
            className="ambient-orb absolute rounded-full"
            style={{
              width: orb.size,
              height: orb.size,
              top: orb.top,
              right: orb.right,
              bottom: orb.bottom,
              left: orb.left,
              background: `radial-gradient(circle, rgba(${orb.color},${op}), transparent 70%)`,
              filter: 'blur(60px)',
            }}
            animate={{
              x: [0, 18, -10, 0],
              y: [0, -22, 14, 0],
              scale: [1, 1.04, 0.98, 1],
            }}
            transition={{
              duration: orb.dur,
              delay: orb.delay,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
        ))}

        {/* Film grain texture */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.015]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
            backgroundSize: '180px 180px',
          }}
        />
      </div>

      {/* Content */}
      {children}
    </div>
  )
}
