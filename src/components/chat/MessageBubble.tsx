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
          className={cn(
            'rounded-2xl px-4 py-2.5 text-sm',
            isOwn
              ? 'rounded-br-sm bg-pepper text-white'
              : 'rounded-bl-sm bg-fog text-ink dark:bg-coal dark:text-cream',
          )}
        >
          {message.content}
        </div>
        <p
          className={cn(
            'mt-1 text-[10px] text-mist',
            isOwn ? 'text-right' : 'text-left',
          )}
        >
          {timeAgo(message.created_at)}
        </p>
      </div>
    </div>
  )
}
