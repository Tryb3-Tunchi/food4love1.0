import Image from 'next/image'
import type { Post } from '@/types/db'

export function PostFeed({
  posts,
  emptyMessage = 'No posts yet.',
}: {
  posts: Post[]
  emptyMessage?: string
}) {
  if (posts.length === 0) {
    return (
      <p className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 text-sm text-[var(--text-3)]">
        {emptyMessage}
      </p>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {posts.map((post) => (
        <article
          key={post.id}
          className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)]"
        >
          {(post.video_url || post.image_url) && (
            <div className="relative aspect-[4/5] bg-black">
              {post.video_url ? (
                <video
                  src={post.video_url}
                  poster={post.image_url ?? undefined}
                  controls
                  preload="metadata"
                  className="h-full w-full object-cover"
                  aria-label={post.caption || 'Saved chef post'}
                />
              ) : (
                <Image
                  src={post.image_url!}
                  alt={post.caption || 'Saved chef post'}
                  fill
                  sizes="(max-width: 640px) 100vw, 50vw"
                  className="object-cover"
                />
              )}
            </div>
          )}
          {post.caption && (
            <p className="p-3 text-sm leading-relaxed text-[var(--text-2)]">
              {post.caption}
            </p>
          )}
          <p className="px-3 pb-3 text-xs text-[var(--text-3)]">
            {new Date(post.created_at).toLocaleDateString('en-NG', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </p>
        </article>
      ))}
    </div>
  )
}
