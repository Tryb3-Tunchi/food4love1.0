'use client'
import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import imageCompression from 'browser-image-compression'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/useAuthStore'
import { updateProfile } from '@/services/profiles'
import { Button } from '@/components/ui/Button'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { Upload, X } from 'lucide-react'
import { motion } from 'framer-motion'

export default function PhotosPage() {
  const router = useRouter()
  const profile = useAuthStore((s) => s.profile)
  const updateStore = useAuthStore((s) => s.updateProfile)
  const [photos, setPhotos] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)

  const onDrop = useCallback(
    async (files: File[]) => {
      if (!profile) return
      setUploading(true)
      const sb = createClient()
      const urls: string[] = []
      for (const file of files.slice(0, 5 - photos.length)) {
        try {
          const compressed = await imageCompression(file, {
            maxSizeMB: 1,
            maxWidthOrHeight: 1200,
          })
          const path = `${profile.id}/${Date.now()}-${file.name}`
          const { error } = await sb.storage
            .from('profile-photos')
            .upload(path, compressed)
          if (!error) {
            const { data } = sb.storage
              .from('profile-photos')
              .getPublicUrl(path)
            urls.push(data.publicUrl)
          }
        } catch {}
      }
      setPhotos((p) => [...p, ...urls])
      setUploading(false)
    },
    [profile, photos],
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': [] },
    maxFiles: 5,
  })

  const save = async () => {
    if (!profile || photos.length === 0) {
      toast.error('Add at least one photo')
      return
    }
    await updateProfile(profile.id, { photos, avatar_url: photos[0] })
    updateStore({ photos, avatar_url: photos[0] })
    toast.success('Photos saved!')
    router.push('/swipe')
  }

  return (
    <div className="flex min-h-screen flex-col bg-char px-5 py-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-auto w-full max-w-sm"
      >
        <div className="mb-8">
          <div className="mb-6 flex gap-1">
            {[1, 2, 3].map((s) => (
              <div key={s} className="h-1 flex-1 rounded-full bg-pepper" />
            ))}
          </div>
          <h1 className="mb-1 text-2xl font-bold text-white">
            Add your photos
          </h1>
          <p className="text-sm text-mist">Step 3 of 3 — Show your best self</p>
        </div>

        <div
          {...getRootProps()}
          className={`mb-4 cursor-pointer rounded-2xl border-2 border-dashed p-8 text-center transition-all ${isDragActive ? 'border-pepper bg-pepper/10' : 'border-white/10 hover:border-white/20'}`}
        >
          <input {...getInputProps()} />
          <Upload className="mx-auto mb-3 h-8 w-8 text-mist" />
          <p className="text-sm font-medium text-white">
            {isDragActive ? 'Drop photos here' : 'Tap to add photos'}
          </p>
          <p className="mt-1 text-xs text-mist">
            Up to 5 photos · JPEG, PNG, WebP
          </p>
        </div>

        {photos.length > 0 && (
          <div className="mb-6 grid grid-cols-3 gap-2">
            {photos.map((url, i) => (
              <div
                key={url}
                className="relative aspect-square overflow-hidden rounded-xl"
              >
                <img src={url} alt="" className="h-full w-full object-cover" />
                {i === 0 && (
                  <span className="absolute left-1 top-1 rounded-full bg-pepper px-2 py-0.5 text-[10px] font-bold text-white">
                    Main
                  </span>
                )}
                <button
                  onClick={() => setPhotos((p) => p.filter((_, j) => j !== i))}
                  className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        <Button
          size="lg"
          className="w-full"
          loading={uploading}
          onClick={save}
          disabled={photos.length === 0}
        >
          {photos.length === 0
            ? 'Add at least 1 photo'
            : `Continue with ${photos.length} photo${photos.length > 1 ? 's' : ''} →`}
        </Button>
      </motion.div>
    </div>
  )
}
