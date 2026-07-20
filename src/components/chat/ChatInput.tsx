'use client'
import { useState, useRef } from 'react'
import { Send, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ChatInputProps {
  onSend: (msg: string) => void
  loading?: boolean
  suggestions?: string[]
}

export function ChatInput({ onSend, loading, suggestions }: ChatInputProps) {
  const [value, setValue] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(!!suggestions?.length)
  const ref = useRef<HTMLTextAreaElement>(null)

  const handleSend = () => {
    const msg = value.trim()
    if (!msg || loading) return
    onSend(msg)
    setValue('')
    setShowSuggestions(false)
    ref.current?.focus()
  }

  return (
    <div className="safe-bottom border-t border-fog bg-white p-3 dark:border-coal dark:bg-smoke">
      {showSuggestions && suggestions?.length && (
        <div className="scrollbar-none mb-2 flex gap-2 overflow-x-auto pb-1">
          {suggestions.map((s) => (
            <button
              key={s}
              onClick={() => {
                setValue(s)
                setShowSuggestions(false)
              }}
              className="shrink-0 rounded-full border border-pepper/30 bg-pepper/5 px-3 py-1 text-xs text-pepper transition-all hover:bg-pepper/10"
            >
              {s}
            </button>
          ))}
        </div>
      )}
      <div className="flex items-end gap-2">
        <div className="flex-1 overflow-hidden rounded-xl border border-fog bg-fog dark:border-coal dark:bg-coal">
          <textarea
            ref={ref}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSend()
              }
            }}
            placeholder="Say something tasty..."
            rows={1}
            className="max-h-24 w-full resize-none bg-transparent px-3 py-2.5 text-sm text-ink outline-none placeholder:text-mist dark:text-cream"
            style={{ height: 'auto' }}
          />
        </div>
        <button
          onClick={handleSend}
          disabled={!value.trim() || loading}
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all',
            value.trim()
              ? 'bg-pepper text-white shadow-glow active:scale-95'
              : 'bg-fog text-mist dark:bg-coal',
          )}
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
