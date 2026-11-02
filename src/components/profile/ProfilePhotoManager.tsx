'use client'

import { useRef, useState } from 'react'
import imageCompression from 'browser-image-compression'
import { Camera, Check, Loader2, Plus, Star, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { updateProfile } from '@/services/profiles'
import { useAuthStore } from '@/stores/useAuthStore'
import type { Profile } from '@/types/db'

const BUCKET = 'profile-photos'
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

function ownedObjectPath(url: string, userId: string) {
  try {
    const marker = `/storage/v1/object/public/${BUCKET}/`
    const pathname = new URL(url).pathname
    if (!pathname.includes(marker)) return null
    const path = decodeURIComponent(pathname.split(marker)[1] ?? '')
    return path.startsWith(`${userId}/`) ? path : null
  } catch {
    return null
  }
}

export function ProfilePhotoManager({ profile }: { profile: Profile }) {
  const fileInput = useRef<HTMLInputElement>(null)
  const avatarInput = useRef<HTMLInputElement>(null)
  const updateStore = useAuthStore((state) => state.updateProfile)
  const queryClient = useQueryClient()
  const [uploading, setUploading] = useState<'avatar' | 'gallery' | null>(null)
  const [removingUrl, setRemovingUrl] = useState<string | null>(null)
  const isCook = profile.role === 'cook'
  const photos = profile.photos ?? []
  const maxPhotos = isCook ? 5 : 2
  const suggestedMinimum = isCook ? 4 : 2

  const saveProfile = async (updates: Partial<Profile>) => {
    const saved = await updateProfile(profile.id, updates)
    updateStore(updates)
    queryClient.setQueryData(['profile', profile.id], saved)
  }

  const upload = async (
    file?: File,
    kind: 'avatar' | 'gallery' = 'gallery',
  ) => {
    if (!file) return
    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast.error('Choose a JPG, PNG, or WebP image')
      return
    }
    if (file.size > 12 * 1024 * 1024) {
      toast.error('Choose an image smaller than 12 MB')
      return
    }
    if (kind === 'gallery' && photos.length >= maxPhotos) {
      toast.error(`You can add up to ${maxPhotos} profile photos`)
      return
    }

    setUploading(kind)
    const supabase = createClient()
    let uploadedPath: string | null = null
    try {
      const compressed = await imageCompression(file, {
        maxSizeMB: 0.8,
        maxWidthOrHeight: 1600,
        useWebWorker: true,
      })
      const extension =
        file.type === 'image/png'
          ? 'png'
          : file.type === 'image/webp'
            ? 'webp'
            : 'jpg'
      uploadedPath = `${profile.id}/${crypto.randomUUID()}.${extension}`
      const { error: storageError } = await supabase.storage
        .from(BUCKET)
        .upload(uploadedPath, compressed, {
          contentType: file.type,
          cacheControl: '3600',
          upsert: false,
        })
      if (storageError) throw storageError

      const { data } = supabase.storage.from(BUCKET).getPublicUrl(uploadedPath)
      const updates: Partial<Profile> =
        kind === 'avatar'
          ? { avatar_url: data.publicUrl }
          : { photos: [...photos, data.publicUrl] }
      await saveProfile(updates)
      toast.success(kind === 'avatar' ? 'Profile photo updated' : 'Photo added')
    } catch (error) {
      if (uploadedPath) {
        await supabase.storage.from(BUCKET).remove([uploadedPath])
      }
      toast.error(
        error instanceof Error && error.message.includes('Bucket not found')
          ? 'Profile photo storage is not set up yet. Ask an administrator to apply the profile photo SQL migration.'
          : 'Could not save that photo. Please try again.',
      )
    } finally {
      setUploading(null)
      if (fileInput.current) fileInput.current.value = ''
      if (avatarInput.current) avatarInput.current.value = ''
    }
  }

  const makeAvatar = async (url: string) => {
    try {
      await saveProfile({ avatar_url: url })
      toast.success('Main profile photo updated')
    } catch {
      toast.error('Could not update your main photo')
    }
  }

  const removeAvatar = async () => {
    const avatarUrl = profile.avatar_url
    if (!avatarUrl) return
    try {
      await saveProfile({ avatar_url: null })
      if (!photos.includes(avatarUrl)) {
        const path = ownedObjectPath(avatarUrl, profile.id)
        if (path) await createClient().storage.from(BUCKET).remove([path])
      }
      toast.success('Main profile photo removed')
    } catch {
      toast.error('Could not remove your main photo')
    }
  }

  const removePhoto = async (url: string) => {
    setRemovingUrl(url)
    try {
      const nextPhotos = photos.filter((photo) => photo !== url)
      const updates: Partial<Profile> = { photos: nextPhotos }
      if (profile.avatar_url === url) updates.avatar_url = null
      await saveProfile(updates)
      const path = ownedObjectPath(url, profile.id)
      if (path) {
        await createClient().storage.from(BUCKET).remove([path])
      }
      toast.success('Photo removed from your profile')
    } catch {
      toast.error('Could not remove that photo')
    } finally {
      setRemovingUrl(null)
    }
  }

  return (
    <section
      aria-labelledby="profile-photos-heading"
      className="mx-4 mt-4 rounded-2xl border p-4 sm:p-5"
      style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2
            id="profile-photos-heading"
            className="font-heading text-base font-bold"
            style={{ color: 'var(--text-1)' }}
          >
            Your photos
          </h2>
          <p
            className="mt-1 max-w-xl text-xs leading-5"
            style={{ color: 'var(--text-3)' }}
          >
            {isCook
              ? 'Use your face as the main photo, then add four or five photos of meals you make.'
              : 'Use your face as the main photo and add two photos so people can get to know you.'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => avatarInput.current?.click()}
          disabled={uploading !== null}
          className="inline-flex min-h-10 items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold text-white disabled:opacity-60"
          style={{ background: 'var(--accent)' }}
        >
          {uploading === 'avatar' ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Camera className="h-4 w-4" />
          )}
          Update main photo
        </button>
        {profile.avatar_url && (
          <button
            type="button"
            onClick={() => void removeAvatar()}
            className="inline-flex min-h-10 items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold"
            style={{ borderColor: 'var(--border)', color: 'var(--text-2)' }}
          >
            <Trash2 className="h-4 w-4" />
            Remove main photo
          </button>
        )}
        <input
          ref={avatarInput}
          type="file"
          accept={ACCEPTED_TYPES.join(',')}
          className="sr-only"
          aria-label="Upload main profile photo"
          onChange={(event) => void upload(event.target.files?.[0], 'avatar')}
        />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
        {photos.map((photo, index) => {
          const isMain = profile.avatar_url === photo
          return (
            <div
              key={photo}
              className="group relative aspect-square overflow-hidden rounded-xl border"
              style={{ borderColor: 'var(--border)' }}
            >
              <img
                src={photo}
                alt={`Profile photo ${index + 1}`}
                className="h-full w-full object-cover"
              />
              {isMain && (
                <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/65 px-2 py-1 text-[10px] font-semibold text-white">
                  <Check className="h-3 w-3" /> Main
                </span>
              )}
              <div className="absolute inset-x-1 bottom-1 flex justify-between gap-1 opacity-100 sm:opacity-0 sm:transition-opacity sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
                {!isMain && (
                  <button
                    type="button"
                    onClick={() => void makeAvatar(photo)}
                    aria-label={`Set photo ${index + 1} as main photo`}
                    className="flex h-9 w-9 items-center justify-center rounded-lg bg-black/70 text-white"
                  >
                    <Star className="h-4 w-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void removePhoto(photo)}
                  disabled={removingUrl === photo}
                  aria-label={`Remove photo ${index + 1}`}
                  className="ml-auto flex h-9 w-9 items-center justify-center rounded-lg bg-black/70 text-white disabled:opacity-50"
                >
                  {removingUrl === photo ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
          )
        })}
        {photos.length < maxPhotos && (
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            disabled={uploading !== null}
            className="flex aspect-square flex-col items-center justify-center gap-2 rounded-xl border border-dashed text-xs font-semibold transition hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-60"
            style={{ borderColor: 'var(--border)', color: 'var(--text-3)' }}
          >
            {uploading === 'gallery' ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Plus className="h-5 w-5" />
            )}
            Add photo
          </button>
        )}
      </div>
      <input
        ref={fileInput}
        type="file"
        accept={ACCEPTED_TYPES.join(',')}
        className="sr-only"
        aria-label="Add profile photo"
        onChange={(event) => void upload(event.target.files?.[0], 'gallery')}
      />
      <p className="mt-3 text-[11px]" style={{ color: 'var(--text-3)' }}>
        {photos.length} of {maxPhotos} gallery photos ·{' '}
        {photos.length < suggestedMinimum
          ? `Add ${suggestedMinimum - photos.length} more to reach the suggested minimum · `
          : 'Photo set is ready · '}
        JPG, PNG, or WebP, max 12 MB
      </p>
    </section>
  )
}
