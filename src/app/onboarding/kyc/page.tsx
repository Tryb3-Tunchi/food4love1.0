'use client'
import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/useAuthStore'
import { submitKYC } from '@/services/kyc'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { Shield, Video, FileText, CheckCircle } from 'lucide-react'
import { motion } from 'framer-motion'
import { useForm } from 'react-hook-form'

const ID_TYPES = ['nin', 'bvn', 'passport', 'drivers_license'] as const

export default function KYCPage() {
  const router = useRouter()
  const profile = useAuthStore((s) => s.profile)
  const updateStore = useAuthStore((s) => s.updateProfile)
  const [idDoc, setIdDoc] = useState('')
  const [faceVideo, setFaceVideo] = useState('')
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [idType, setIdType] = useState<
    'nin' | 'bvn' | 'passport' | 'drivers_license'
  >('nin')
  const { register, handleSubmit } = useForm<{ idNumber: string }>()

  const uploadFile = useCallback(
    async (file: File, folder: string) => {
      if (!profile) throw new Error('Sign in to upload verification documents')
      const sb = createClient()
      const extension = file.name
        .split('.')
        .pop()
        ?.replace(/[^a-z0-9]/gi, '')
      const path = `${profile.id}/${folder}/${crypto.randomUUID()}${extension ? `.${extension}` : ''}`
      const { error } = await sb.storage
        .from('kyc-documents')
        .upload(path, file)
      if (error) throw error
      return path
    },
    [profile],
  )

  const onDropId = useCallback(
    async (files: File[]) => {
      if (!files[0] || !profile) return
      setUploading(true)
      try {
        setIdDoc(await uploadFile(files[0], 'id-docs'))
        toast.success('ID uploaded')
      } catch (error) {
        toast.error(
          error instanceof Error && /bucket.*not found/i.test(error.message)
            ? 'Secure KYC uploads are not configured yet. Please contact support.'
            : 'Could not upload the ID document. Check the file type and try again.',
        )
      } finally {
        setUploading(false)
      }
    },
    [profile, uploadFile],
  )

  const onDropVideo = useCallback(
    async (files: File[]) => {
      if (!files[0] || !profile) return
      setUploading(true)
      try {
        setFaceVideo(await uploadFile(files[0], 'face-videos'))
        toast.success('Video uploaded')
      } catch (error) {
        toast.error(
          error instanceof Error && /bucket.*not found/i.test(error.message)
            ? 'Secure KYC uploads are not configured yet. Please contact support.'
            : 'Could not upload the face video. Check the file type and try again.',
        )
      } finally {
        setUploading(false)
      }
    },
    [profile, uploadFile],
  )

  const idDz = useDropzone({
    onDrop: onDropId,
    accept: {
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/webp': ['.webp'],
      'application/pdf': ['.pdf'],
    },
    maxFiles: 1,
    maxSize: 50 * 1024 * 1024,
  })
  const vidDz = useDropzone({
    onDrop: onDropVideo,
    accept: {
      'video/mp4': ['.mp4'],
      'video/quicktime': ['.mov'],
    },
    maxFiles: 1,
    maxSize: 50 * 1024 * 1024,
  })

  const submit = async (data: { idNumber: string }) => {
    if (!profile || !idDoc || !faceVideo) {
      toast.error('Please upload all documents')
      return
    }
    setSubmitting(true)
    try {
      await submitKYC({
        id_type: idType,
        id_number: data.idNumber,
        id_document_path: idDoc,
        face_video_path: faceVideo,
      })
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Could not submit verification',
      )
      setSubmitting(false)
      return
    }
    updateStore({ kyc_status: 'pending' })
    toast.success('Submitted! We will review within 24-48 hours.')
    router.push('/swipe')
  }

  return (
    <div className="flex min-h-screen flex-col bg-char px-5 py-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-auto w-full max-w-sm"
      >
        <div className="mb-6 text-center">
          <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl border border-pepper/20 bg-pepper/10">
            <Shield className="h-8 w-8 text-pepper" />
          </div>
          <h1 className="mb-1 text-2xl font-bold text-white">
            Verify your identity
          </h1>
          <p className="text-sm text-mist">
            You can browse while we review — but you need this to sell.
          </p>
        </div>
        <div className="mb-5 rounded-xl border border-ember/20 bg-ember/5 p-3">
          <p className="text-xs text-ember">
            ⏱ Reviews take 24–48 hours. You can use the app in the meantime.
          </p>
        </div>
        <form onSubmit={handleSubmit(submit)} className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-white">
              ID Type
            </label>
            <div className="grid grid-cols-2 gap-2">
              {ID_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setIdType(t)}
                  className={`rounded-xl border px-3 py-2 text-xs font-medium transition-all ${idType === t ? 'border-pepper bg-pepper/10 text-pepper' : 'border-white/10 bg-coal text-mist'}`}
                >
                  {t.replace('_', ' ').toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          <Input
            label="ID Number"
            placeholder="Enter your ID number"
            {...register('idNumber', { required: true })}
          />
          <div>
            <label className="mb-2 block text-sm font-medium text-white">
              ID Document
            </label>
            <div
              {...idDz.getRootProps()}
              className={`cursor-pointer rounded-xl border-2 border-dashed p-5 text-center transition-all ${idDoc ? 'border-lime/40 bg-lime/5' : 'border-white/10 hover:border-white/20'}`}
            >
              <input {...idDz.getInputProps()} />
              {idDoc ? (
                <>
                  <CheckCircle className="mx-auto mb-1 h-6 w-6 text-lime" />
                  <p className="text-xs text-lime">Uploaded ✓</p>
                </>
              ) : (
                <>
                  <FileText className="mx-auto mb-1 h-6 w-6 text-mist" />
                  <p className="text-xs text-mist">
                    Upload NIN, passport or license photo
                  </p>
                </>
              )}
            </div>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-white">
              Face Video <span className="text-pepper">*required</span>
            </label>
            <div className="mb-2 rounded-xl border border-ember/20 bg-ember/5 p-3">
              <p className="text-xs text-ember">
                Record 5–10 seconds saying:{' '}
                <strong>
                  "My name is [name] and I am a home chef on Food4Love"
                </strong>
              </p>
            </div>
            <div
              {...vidDz.getRootProps()}
              className={`cursor-pointer rounded-xl border-2 border-dashed p-5 text-center transition-all ${faceVideo ? 'border-lime/40 bg-lime/5' : 'border-white/10 hover:border-white/20'}`}
            >
              <input {...vidDz.getInputProps()} />
              {faceVideo ? (
                <>
                  <CheckCircle className="mx-auto mb-1 h-6 w-6 text-lime" />
                  <p className="text-xs text-lime">Video uploaded ✓</p>
                </>
              ) : (
                <>
                  <Video className="mx-auto mb-1 h-6 w-6 text-mist" />
                  <p className="text-xs text-mist">MP4 or MOV, max 50MB</p>
                </>
              )}
            </div>
          </div>
          <Button
            type="submit"
            size="lg"
            className="w-full"
            loading={submitting}
            disabled={!idDoc || !faceVideo || uploading || submitting}
          >
            Submit for Review →
          </Button>
          <button
            type="button"
            onClick={() => router.push('/swipe')}
            className="w-full text-center text-sm text-mist hover:text-ash"
          >
            Skip for now
          </button>
        </form>
      </motion.div>
    </div>
  )
}
