import { cn, timeAgo } from '@/lib/utils'
import { Message } from '@/types/db'

interface MessageBubbleProps {
  message: Message
  isOwn: boolean
  showAvatar?: boolean
}

export function MessageBubble({ message, isOwn }: MessageBubbleProps) {
  return (
    <div className={cn('mb-2 flex', isOwn ? 'justify-end' : 'justify-start')}>
      <div className="max-w-[75%]">
        <div
          className={cn('rounded-2xl px-4 py-2.5 text-sm')}
          style={
            isOwn
              ? {
                  background: 'var(--accent)',
                  color: '#fff',
                  borderBottomRightRadius: '4px',
                }
              : {
                  background: 'var(--card)',
                  color: 'var(--text-1)',
                  border: '1px solid var(--border)',
                  borderBottomLeftRadius: '4px',
                }
          }
        >
          {message.content}
        </div>
        <p
          className={cn('mt-1 text-[10px]', isOwn ? 'text-right' : 'text-left')}
          style={{ color: 'var(--text-3)' }}
        >
          {timeAgo(message.created_at)}
        </p>
      </div>
    </div>
  )
}
