'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Camera, Film, Play, UtensilsCrossed } from 'lucide-react'
import { formatNaira } from '@/lib/utils'
import type { DailySpecial, Post } from '@/types/db'

const TILE = 'relative aspect-[4/5] overflow-hidden rounded-2xl'

function AddTile({
  href,
  icon: Icon,
  label,
}: {
  href: string
  icon: typeof Camera
  label: string
}) {
  return (
    <Link
      href={href}
      className={`${TILE} flex flex-col items-center justify-center gap-2 border-2 border-dashed`}
      style={{ borderColor: 'var(--border)', color: 'var(--text-3)' }}
    >
      <Icon className="h-6 w-6" />
      <span className="text-xs font-semibold">{label}</span>
    </Link>
  )
}

export function DashboardGallery({
  specials,
  posts,
  cookId,
}: {
  specials: DailySpecial[]
  posts: Post[]
  cookId: string
}) {
  const [tab, setTab] = useState<'menu' | 'posts'>('menu')

  const tabs = [
    { key: 'menu' as const, label: 'Menu', count: specials.length },
    { key: 'posts' as const, label: 'Posts', count: posts.length },
  ]

  return (
    <section>
      <div
        className="mb-3 flex border-b"
        style={{ borderColor: 'var(--divider)' }}
      >
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className="relative flex-1 py-2.5 text-sm font-semibold"
            style={{ color: tab === t.key ? 'var(--accent)' : 'var(--text-3)' }}
          >
            {t.label}
            <span className="ml-1.5 text-xs font-normal">{t.count}</span>
            {tab === t.key && (
              <span
                className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full"
                style={{ background: 'var(--accent)' }}
              />
            )}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {tab === 'menu' ? (
          <>
            <AddTile href="/cook/specials" icon={Camera} label="Add a dish" />
            {specials.map((special) => (
              <Link
                key={special.id}
                href="/cook/specials"
                className={TILE}
                style={{
                  background:
                    'linear-gradient(135deg, var(--accent-l), var(--divider))',
                }}
              >
                {special.image_url ? (
                  <img
                    src={special.image_url}
                    alt={special.title}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <UtensilsCrossed
                      className="h-8 w-8"
                      style={{ color: 'var(--accent)' }}
                    />
                  </div>
                )}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3 pt-8">
                  <p className="truncate text-sm font-semibold text-white">
                    {special.title}
                  </p>
                  <p className="text-xs text-white/80">
                    {formatNaira(special.price)}
                  </p>
                </div>
              </Link>
            ))}
          </>
        ) : (
          <>
            <AddTile href="/stories/new" icon={Film} label="Post a story" />
            {posts.map((post) => (
              <Link
                key={post.id}
                href={`/cook/${cookId}`}
                className={`${TILE} bg-black`}
              >
                {post.image_url ? (
                  <img
                    src={post.image_url}
                    alt={post.caption ?? 'Post'}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <>
                    <video
                      src={post.video_url ?? undefined}
                      muted
                      playsInline
                      preload="metadata"
                      className="h-full w-full object-cover"
                    />
                    <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white">
                      <Play className="h-3 w-3" fill="currentColor" />
                    </span>
                  </>
                )}
                {post.caption && (
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3 pt-8">
                    <p className="line-clamp-2 text-xs text-white">
                      {post.caption}
                    </p>
                  </div>
                )}
              </Link>
            ))}
          </>
        )}
      </div>

      {tab === 'menu' && specials.length === 0 && (
        <p className="mt-3 text-xs" style={{ color: 'var(--text-3)' }}>
          Dishes with a photo get noticed first. Add your first one.
        </p>
      )}
      {tab === 'posts' && posts.length === 0 && (
        <p className="mt-3 text-xs" style={{ color: 'var(--text-3)' }}>
          Stories you save stay here as posts on your public profile.
        </p>
      )}
    </section>
  )
}
