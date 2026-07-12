'use client'
import * as Dialog from '@radix-ui/react-dialog'
import { cn } from '@/lib/utils'
import { X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface SheetProps {
  open: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  className?: string
}

export function Sheet({
  open,
  onClose,
  title,
  children,
  className,
}: SheetProps) {
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
            <Dialog.Content asChild>
              <motion.div
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                className={cn(
                  'fixed bottom-0 left-0 right-0 z-50 mx-auto max-w-lg rounded-t-2xl bg-white shadow-float dark:bg-smoke',
                  className,
                )}
              >
                <div className="mx-auto mt-3 h-1 w-10 rounded-full bg-fog dark:bg-coal" />
                {title && (
                  <div className="flex items-center justify-between px-5 pb-2 pt-4">
                    <Dialog.Title className="text-base font-semibold text-ink dark:text-cream">
                      {title}
                    </Dialog.Title>
                    <button
                      onClick={onClose}
                      className="rounded-lg p-1 hover:bg-fog dark:hover:bg-coal"
                    >
                      <X className="h-4 w-4 text-ash" />
                    </button>
                  </div>
                )}
                <div className="pb-safe max-h-[80vh] overflow-y-auto">
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
