'use client'

import { motion } from 'framer-motion'
import { Receipt } from 'lucide-react'

interface PriceBreakdownProps {
  subtotal: number
  deliveryFee: number
  serviceFee: number
  total: number
}

export function PriceBreakdown({
  subtotal,
  deliveryFee,
  serviceFee,
  total,
}: PriceBreakdownProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-3 rounded-2xl bg-[var(--surface)] p-4"
    >
      <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text)]">
        <Receipt className="h-4 w-4 text-[var(--primary)]" />
        Price Breakdown
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex justify-between text-[var(--text-muted)]">
          <span>Subtotal</span>
          <span>₦{subtotal.toLocaleString()}</span>
        </div>
        <div className="flex justify-between text-[var(--text-muted)]">
          <span>Delivery Fee</span>
          <span>₦{deliveryFee.toLocaleString()}</span>
        </div>
        <div className="flex justify-between text-[var(--text-muted)]">
          <span>Service Fee (5%)</span>
          <span>₦{serviceFee.toLocaleString()}</span>
        </div>
        <div className="border-t border-[var(--border)] pt-2" />
        <div className="flex justify-between text-base font-bold text-[var(--text)]">
          <span>Total</span>
          <span className="text-[var(--primary)]">
            ₦{total.toLocaleString()}
          </span>
        </div>
      </div>
    </motion.div>
  )
}
