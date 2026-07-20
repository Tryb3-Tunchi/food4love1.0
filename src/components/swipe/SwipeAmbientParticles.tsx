'use client'
import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'

interface Particle {
  id: number
  size: number
  initialX: string
  initialY: string
  moveX: number
  moveY: number
  duration: number
  delay: number
}

export function SwipeAmbientParticles() {
  const [particles, setParticles] = useState<Particle[]>([])

  useEffect(() => {
    // Generate constant positions deterministically on client mount
    const generated = Array.from({ length: 15 }).map((_, i) => ({
      id: i,
      size: Math.random() * 4 + 2, // 2px to 6px
      initialX: `${Math.random() * 100}%`,
      initialY: `${Math.random() * 40 + 50}%`, // Focus on lower half
      moveX: Math.random() * 60 - 30,
      moveY: -(Math.random() * 100 + 50), // Always float upwards
      duration: Math.random() * 6 + 6, // 6s to 12s loops
      delay: Math.random() * 4,
    }))
    setParticles(generated)
  }, [])

  return (
    <div className="pointer-events-none absolute inset-0 z-0 select-none overflow-hidden">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute rounded-full bg-[color:var(--accent)] opacity-[0.22] mix-blend-screen blur-[0.5px]"
          style={{
            width: p.size,
            height: p.size,
            left: p.initialX,
            top: p.initialY,
            boxShadow: '0 0 8px var(--accent)',
          }}
          animate={{
            x: [0, p.moveX, p.moveX * 1.5],
            y: [0, p.moveY * 0.5, p.moveY],
            opacity: [0, 0.35, 0.15, 0],
          }}
          transition={{
            duration: p.duration,
            repeat: Infinity,
            delay: p.delay,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  )
}
