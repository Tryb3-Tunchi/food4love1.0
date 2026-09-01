'use client'

import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useDropzone } from 'react-dropzone'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { Film, Upload, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/useAuthStore'
import { useStories } from '@/hooks/useStories'
import { Button } from '@/components/ui/Button'

const MAX_VIDEO_MB = 50

export default function NewStoryPage() {
  const router = useRouter()
  const profile = useAuthStore((s) => s.profile)
  const { postStory } = useStories(profile?.id ?? null)

  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [caption, setCaption] = useState('')
  const [uploading, setUploading] = useState(false)

  const onDrop = useCallback((files: File[]) => {
    const picked = files[0]
    if (!picked) return
    if (picked.size > MAX_VIDEO_MB * 1024 * 1024) {
      toast.error(`Keep videos under ${MAX_VIDEO_MB}MB`)
      return
    }
    setFile(picked)
    setPreviewUrl(URL.createObjectURL(picked))
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'video/*': [] },
    maxFiles: 1,
  })

  const clearFile = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setFile(null)
    setPreviewUrl(null)
  }

  const submit = async () => {
    if (!profile || !file) {
      toast.error('Add a video first')
      return
    }
    setUploading(true)
    try {
      const sb = createClient()
      const path = `${profile.id}/${Date.now()}-${file.name}`
      const { error: uploadError } = await sb.storage
        .from('story-media')
        .upload(path, file)
      if (uploadError) throw uploadError

      const { data } = sb.storage.from('story-media').getPublicUrl(path)
      await postStory({ caption, video_url: data.publicUrl })

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
    <div className="min-h-screen bg-[var(--bg)]">
      <div className="bg-[var(--bg)]/80 sticky top-0 z-10 border-b border-[var(--border)] px-4 py-4 backdrop-blur-xl">
        <h1 className="text-2xl font-bold">Post a story</h1>
        <p className="text-sm text-[var(--text-3)]">
          Share a short video of what you're cooking — live for 24 hours.
        </p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-4 p-4"
      >
        {!previewUrl ? (
          <div
            {...getRootProps()}
            className={`cursor-pointer rounded-2xl border-2 border-dashed p-8 text-center transition-all ${
              isDragActive
                ? 'border-[var(--accent)] bg-[var(--accent)]/10'
                : 'border-[var(--border)] hover:border-[var(--text-3)]'
            }`}
          >
            <input {...getInputProps()} />
            <Film className="mx-auto mb-3 h-8 w-8 text-[var(--text-3)]" />
            <p className="text-sm font-medium">
              {isDragActive ? 'Drop your video here' : 'Tap to add a video'}
            </p>
            <p className="mt-1 text-xs text-[var(--text-3)]">
              MP4, MOV, or WebM · Up to {MAX_VIDEO_MB}MB
            </p>
          </div>
        ) : (
          <div className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-black">
            <video
              src={previewUrl}
              controls
              className="max-h-[420px] w-full"
            />
            <button
              onClick={clearFile}
              className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white"
              aria-label="Remove video"
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

        <Button
          size="lg"
          className="w-full bg-[var(--accent)]"
          leftIcon={!uploading ? <Upload className="h-4 w-4" /> : undefined}
          loading={uploading}
          disabled={!file}
          onClick={submit}
        >
          {file ? 'Post story' : 'Add a video to continue'}
        </Button>
      </motion.div>
    </div>
  )
}
