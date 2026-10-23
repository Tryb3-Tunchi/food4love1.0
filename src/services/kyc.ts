export interface KYCSubmission {
  id: string
  user_id: string
  full_name: string
  id_type: 'nin' | 'bvn' | 'passport' | 'drivers_license'
  id_number: string
  id_document_url: string | null
  face_video_url: string | null
  selfie_url?: string
  status: 'pending' | 'approved' | 'rejected'
  rejection_reason?: string
  submitted_at: string
  reviewed_at?: string
  reviewed_by?: string
  user?: {
    full_name: string | null
    avatar_url: string | null
    role: string | null
  } | null
}

export async function submitKYC(data: {
  id_type: KYCSubmission['id_type']
  id_number: string
  id_document_path: string
  face_video_path: string
}): Promise<{ id: string; status: KYCSubmission['status'] }> {
  const response = await fetch('/api/kyc', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  const result = await response.json().catch(() => ({}))
  if (!response.ok)
    throw new Error(result.error || 'Could not submit KYC details')
  return result.submission
}

export async function getKYCSubmissions(): Promise<KYCSubmission[]> {
  const response = await fetch('/api/admin/kyc', { cache: 'no-store' })
  const result = await response.json().catch(() => ({}))
  if (!response.ok)
    throw new Error(result.error || 'Could not load KYC submissions')
  return result.submissions ?? []
}

export async function reviewKYC(
  id: string,
  approved: boolean,
  rejectionReason?: string,
) {
  const response = await fetch('/api/admin/kyc', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id,
      approved,
      rejection_reason: rejectionReason,
    }),
  })
  const result = await response.json().catch(() => ({}))
  if (!response.ok)
    throw new Error(result.error || 'Could not review KYC submission')
}
