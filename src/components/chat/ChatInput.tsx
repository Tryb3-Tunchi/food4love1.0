'use client'
import { useState, useRef } from 'react'
import { Send } from 'lucide-react'
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
    <div
      className="safe-bottom border-t p-3"
      style={{
        background: 'var(--card)',
        borderColor: 'var(--border)',
      }}
    >
      {showSuggestions && suggestions?.length && (
        <div className="scrollbar-none mb-2 flex gap-2 overflow-x-auto pb-1">
          {suggestions.map((s) => (
            <button
              key={s}
              onClick={() => {
                setValue(s)
                setShowSuggestions(false)
              }}
              className="shrink-0 rounded-full px-3 py-1 text-xs transition-all"
              style={{
                background: 'color-mix(in srgb, var(--accent) 8%, transparent)',
                border:
                  '1px solid color-mix(in srgb, var(--accent) 28%, transparent)',
                color: 'var(--accent)',
              }}
            >
              {s}
            </button>
          ))}
        </div>
      )}
      <div className="flex items-end gap-2">
        <div
          className="flex-1 overflow-hidden rounded-xl"
          style={{
            background: 'var(--bg-2)',
            border: '1px solid var(--border)',
          }}
        >
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
            className="max-h-24 w-full resize-none bg-transparent px-3 py-2.5 text-sm outline-none"
            style={{
              color: 'var(--text-1)',
              height: 'auto',
            }}
          />
        </div>
        <button
          onClick={handleSend}
          disabled={!value.trim() || loading}
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all active:scale-95 disabled:opacity-40',
          )}
          style={{
            background: value.trim() ? 'var(--accent)' : 'var(--bg-2)',
            boxShadow: value.trim()
              ? 'var(--shadow-warm, 0 4px 16px rgba(232,116,40,0.3))'
              : 'none',
          }}
        >
          <Send
            className="h-4 w-4"
            style={{ color: value.trim() ? 'white' : 'var(--text-3)' }}
          />
        </button>
      </div>
    </div>
  )
}
