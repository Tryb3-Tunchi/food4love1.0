'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import { ReactNode } from 'react'

interface EmptyStateProps {
  icon: ReactNode
  title: string
  description: string
  action?: {
    label: string
    href: string
  } | null
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 200 }}
        className="mb-4 flex h-20 w-20 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--bg-2)] text-[var(--accent)]"
      >
        {icon}
      </motion.div>
      <motion.h2
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="mb-2 text-xl font-bold text-[var(--text-1)]"
      >
        {title}
      </motion.h2>
      <motion.p
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="mb-6 max-w-xs text-sm text-[var(--text-3)]"
      >
        {description}
      </motion.p>
      {action && (
        <motion.div
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <Link
            href={action.href}
            className="shadow-[var(--accent)]/20 inline-flex items-center rounded-xl bg-[var(--accent)] px-6 py-3 font-medium text-white shadow-lg transition-all hover:bg-[var(--accent-strong)]"
          >
            {action.label}
          </Link>
        </motion.div>
      )}
    </div>
  )
}
