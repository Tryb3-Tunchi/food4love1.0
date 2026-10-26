'use client'

import { useRef, useState } from 'react'
import imageCompression from 'browser-image-compression'
import toast from 'react-hot-toast'
import { Camera } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { updateProfile } from '@/services/profiles'
import { useAuthStore } from '@/stores/useAuthStore'

export function CoverPhotoButton() {
  const profile = useAuthStore((s) => s.profile)
  const updateStore = useAuthStore((s) => s.updateProfile)
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  const handleFile = async (file: File | undefined) => {
    if (!file || !profile) return
    setUploading(true)
    try {
      const compressed = await imageCompression(file, {
        maxSizeMB: 1,
        maxWidthOrHeight: 1600,
      })
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
      const path = `${profile.id}/cover-${Date.now()}.${ext}`
      const sb = createClient()
      const { error } = await sb.storage
        .from('profile-photos')
        .upload(path, compressed)
      if (error) throw error

      const { data } = sb.storage.from('profile-photos').getPublicUrl(path)
      const photos = [data.publicUrl, ...(profile.photos ?? [])].slice(0, 5)
      await updateProfile(profile.id, { photos })
      updateStore({ photos })
      toast.success('Cover photo updated')
    } catch {
      toast.error('Could not update your cover photo')
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="flex items-center gap-1.5 rounded-full bg-black/40 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-sm disabled:opacity-60"
      >
        <Camera className="h-3.5 w-3.5" />
        {uploading ? 'Uploading…' : 'Change cover'}
      </button>
    </>
  )
}
