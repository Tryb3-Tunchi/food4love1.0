'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Minus, ChefHat } from 'lucide-react'
import Image from 'next/image'

export interface MenuItem {
  id: string
  name: string
  price: number
  image?: string | null
  description?: string
}

interface MenuSelectorProps {
  items: MenuItem[]
  selected: { item: MenuItem; qty: number }[]
  onChange: (selected: { item: MenuItem; qty: number }[]) => void
}

export function MenuSelector({ items, selected, onChange }: MenuSelectorProps) {
  const getQty = (id: string) =>
    selected.find((s) => s.item.id === id)?.qty ?? 0

  const updateQty = (item: MenuItem, delta: number) => {
    const current = getQty(item.id)
    const next = Math.max(0, current + delta)
    const filtered = selected.filter((s) => s.item.id !== item.id)
    if (next > 0) filtered.push({ item, qty: next })
    onChange(filtered)
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">
        Select Dishes
      </h3>

      {items.length === 0 ? (
        <div className="rounded-2xl bg-[var(--surface)] p-6 text-center">
          <ChefHat className="mx-auto mb-2 h-8 w-8 text-[var(--text-muted)] opacity-40" />
          <p className="text-sm text-[var(--text-muted)]">
            No daily specials available
          </p>
          <p className="mt-1 text-xs text-[var(--text-muted)] opacity-60">
            You can still place a custom order below
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => {
            const qty = getQty(item.id)
            const isActive = qty > 0

            return (
              <motion.div
                key={item.id}
                layout
                className={`flex items-center gap-3 rounded-2xl border p-3 transition-colors ${
                  isActive
                    ? 'border-[var(--primary)]/30 bg-[var(--primary)]/5'
                    : 'border-[var(--border)] bg-[var(--surface)]'
                }`}
              >
                {item.image ? (
                  <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl">
                    <Image
                      src={item.image}
                      alt={item.name}
                      fill
                      className="object-cover"
                    />
                  </div>
                ) : (
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[var(--border)]">
                    <ChefHat className="h-6 w-6 text-[var(--text-muted)]" />
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <p className="font-medium text-[var(--text)]">{item.name}</p>
                  <p className="text-sm font-semibold text-[var(--primary)]">
                    ₦{item.price.toLocaleString()}
                  </p>
                  {item.description && (
                    <p className="mt-0.5 line-clamp-1 text-xs text-[var(--text-muted)]">
                      {item.description}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => updateQty(item, -1)}
                    className="hover:bg-[var(--primary)]/20 flex h-8 w-8 items-center justify-center rounded-full bg-[var(--border)] text-[var(--text)] transition"
                  >
                    <Minus className="h-4 w-4" />
                  </button>

                  <AnimatePresence mode="wait">
                    <motion.span
                      key={qty}
                      initial={{ scale: 0.5, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="w-4 text-center text-sm font-bold text-[var(--text)]"
                    >
                      {qty}
                    </motion.span>
                  </AnimatePresence>

                  <button
                    type="button"
                    onClick={() => updateQty(item, 1)}
                    className="hover:bg-[var(--primary)]/90 flex h-8 w-8 items-center justify-center rounded-full bg-[var(--primary)] text-white transition"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}
