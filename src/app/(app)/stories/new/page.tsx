'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useDropzone } from 'react-dropzone'
import imageCompression from 'browser-image-compression'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { Clock, Film, Image as ImageIcon, Upload, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/useAuthStore'
import { useStories } from '@/hooks/useStories'
import { Button } from '@/components/ui/Button'

const MAX_VIDEO_MB = 50
const MAX_IMAGE_MB = 10

const ACCEPTED_TYPES = {
  'image/jpeg': [],
  'image/png': [],
  'image/webp': [],
  'video/mp4': [],
  'video/quicktime': [],
  'video/webm': [],
  'video/x-m4v': [],
}

export default function NewStoryPage() {
  const router = useRouter()
  const profile = useAuthStore((s) => s.profile)
  const { postStory } = useStories(profile?.id ?? null)

  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [caption, setCaption] = useState('')
  const [uploading, setUploading] = useState(false)

  const isVideo = !!file?.type.startsWith('video/')

  const onDrop = useCallback(
    (files: File[]) => {
      const picked = files[0]
      if (!picked) return

      const pickedVideo = picked.type.startsWith('video/')
      const maxMb = pickedVideo ? MAX_VIDEO_MB : MAX_IMAGE_MB
      if (picked.size > maxMb * 1024 * 1024) {
        toast.error(
          `Keep ${pickedVideo ? 'videos' : 'photos'} under ${maxMb}MB`,
        )
        return
      }

      if (previewUrl) URL.revokeObjectURL(previewUrl)
      setFile(picked)
      setPreviewUrl(URL.createObjectURL(picked))
    },
    [previewUrl],
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED_TYPES,
    maxFiles: 1,
    onDropRejected: () => toast.error('That file type isn’t supported'),
  })

  const clearFile = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setFile(null)
    setPreviewUrl(null)
  }

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  const submit = async () => {
    if (!profile || !file) {
      toast.error('Add a photo or video first')
      return
    }
    setUploading(true)
    try {
      const sb = createClient()
      const body = isVideo
        ? file
        : await imageCompression(file, {
            maxSizeMB: 1,
            maxWidthOrHeight: 1600,
          })
      const filename = file.name.replace(/[^a-zA-Z0-9._-]/g, '-')
      const path = `${profile.id}/${Date.now()}-${filename}`
      const { error: uploadError } = await sb.storage
        .from('story-media')
        .upload(path, body, { contentType: file.type })
      if (uploadError) throw uploadError

      const { data } = sb.storage.from('story-media').getPublicUrl(path)
      await postStory(
        isVideo
          ? { caption, video_url: data.publicUrl }
          : { caption, image_url: data.publicUrl },
      )

      toast.success('Story posted — live for 24 hours')
      router.push('/requests')
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Could not post your story',
      )
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] pb-24">
      <div className="bg-[var(--bg)]/80 sticky top-0 z-10 border-b border-[var(--border)] px-4 py-4 backdrop-blur-xl">
        <h1 className="text-2xl font-bold">Post a story</h1>
        <p className="text-sm text-[var(--text-3)]">
          Share a photo or short video of what you’re cooking.
        </p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-auto max-w-md space-y-4 p-4"
      >
        {!previewUrl ? (
          <div>
            <div
              {...getRootProps()}
              className={`flex aspect-[4/5] w-full cursor-pointer flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed p-8 text-center transition-all ${
                isDragActive
                  ? 'bg-[var(--accent)]/10 border-[var(--accent)]'
                  : 'border-[var(--border)] hover:border-[var(--text-3)]'
              }`}
            >
              <input {...getInputProps()} />
              <div
                className="flex gap-3"
                style={{ color: 'var(--accent)' }}
                aria-hidden
              >
                <ImageIcon className="h-9 w-9" />
                <Film className="h-9 w-9" />
              </div>
              <p className="text-base font-semibold">
                {isDragActive ? 'Drop it here' : 'Tap to add a photo or video'}
              </p>
              <p className="text-xs text-[var(--text-3)]">
                Show your food at its best
              </p>
            </div>

            <details className="mt-2 text-xs text-[var(--text-3)]">
              <summary className="inline-flex cursor-pointer items-center gap-1.5">
                Supported files
                <span className="flex h-4 w-4 items-center justify-center rounded-full border border-[var(--text-3)] text-[10px] font-bold">
                  ?
                </span>
              </summary>
              <ul className="mt-2 space-y-1 pl-1">
                <li>Photos: JPG, PNG, WebP (up to {MAX_IMAGE_MB}MB)</li>
                <li>Videos: MP4, MOV, WebM (up to {MAX_VIDEO_MB}MB)</li>
              </ul>
            </details>
          </div>
        ) : (
          <div className="relative aspect-[4/5] w-full overflow-hidden rounded-3xl bg-black">
            {isVideo ? (
              <video
                src={previewUrl}
                controls
                className="h-full w-full object-contain"
              />
            ) : (
              <img
                src={previewUrl}
                alt="Story preview"
                className="h-full w-full object-contain"
              />
            )}
            <button
              onClick={clearFile}
              className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white"
              aria-label="Remove file"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        <div className="space-y-1.5">
          <label className="text-sm font-medium">Caption</label>
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="What did you make today?"
            rows={3}
            className="w-full resize-none rounded-xl border border-[var(--border)] bg-[var(--card)] px-3.5 py-2.5 text-sm outline-none focus:border-[var(--accent)]"
          />
        </div>

        <p className="flex items-center gap-1.5 text-xs text-[var(--text-3)]">
          <Clock className="h-3.5 w-3.5" />
          Your story stays up for 24 hours. Save it to your posts to keep it.
        </p>

        <Button
          size="lg"
          className="w-full bg-[var(--accent)]"
          leftIcon={!uploading ? <Upload className="h-4 w-4" /> : undefined}
          loading={uploading}
          disabled={!file}
          onClick={submit}
        >
          {file ? 'Post story' : 'Add a photo or video to continue'}
        </Button>
      </motion.div>
    </div>
  )
}
