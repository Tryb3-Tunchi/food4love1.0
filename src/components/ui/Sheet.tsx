'use client'
import * as Dialog from '@radix-ui/react-dialog'
import { cn } from '@/lib/utils'
import { X } from 'lucide-react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import type { RefObject } from 'react'

interface SheetProps {
  open: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  className?: string
  returnFocusRef?: RefObject<HTMLElement>
}

export function Sheet({
  open,
  onClose,
  title,
  children,
  className,
  returnFocusRef,
}: SheetProps) {
  const reduceMotion = useReducedMotion()

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
              />
            </Dialog.Overlay>
            <Dialog.Content
              onCloseAutoFocus={(event) => {
                if (returnFocusRef?.current) {
                  event.preventDefault()
                  returnFocusRef.current.focus()
                }
              }}
              asChild
            >
              <motion.div
                initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 24 }}
                transition={{ duration: reduceMotion ? 0 : 0.2 }}
                className={cn(
                  'fixed bottom-0 left-0 right-0 z-50 mx-auto max-h-[min(85dvh,720px)] w-full max-w-lg overflow-hidden rounded-t-2xl border border-[var(--border)] bg-[var(--card)] shadow-float sm:inset-0 sm:bottom-auto sm:my-auto sm:rounded-2xl',
                  className,
                )}
              >
                <div className="mx-auto mt-3 h-1 w-10 rounded-full bg-[var(--border)] sm:hidden" />
                {title && (
                  <div className="flex items-center justify-between px-5 pb-2 pt-4">
                    <Dialog.Title className="text-base font-semibold text-[var(--text-1)]">
                      {title}
                    </Dialog.Title>
                    <Dialog.Description className="sr-only">
                      Food4Love notification center
                    </Dialog.Description>
                    <button
                      type="button"
                      onClick={onClose}
                      aria-label="Close dialog"
                      className="rounded-lg p-2 text-[var(--text-2)] transition-colors hover:bg-[var(--bg-2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )}
                <div className="pb-safe max-h-[calc(min(85dvh,720px)-4rem)] overflow-y-auto sm:max-h-[calc(min(80dvh,680px)-4rem)]">
                  {children}
                </div>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  )
}
