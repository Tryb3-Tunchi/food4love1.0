import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const reviewSchema = z.object({
  id: z.string().uuid(),
  approved: z.boolean(),
  rejection_reason: z.string().trim().max(1000).optional(),
})

async function getAdminUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (user?.app_metadata?.role !== 'admin') return null
  return user
}

function getUserStoragePath(value: string, userId: string) {
  let path = value
  try {
    const parsed = new URL(value)
    const marker = '/kyc-documents/'
    const markerIndex = parsed.pathname.indexOf(marker)
    if (markerIndex >= 0)
      path = decodeURIComponent(
        parsed.pathname.slice(markerIndex + marker.length),
      )
  } catch {
    // Database rows may contain a storage path rather than a URL.
  }

  if (!path.startsWith(`${userId}/`) || path.includes('..')) return null
  return path
}

export async function GET() {
  try {
    const user = await getAdminUser()
    if (!user) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const admin = createAdminClient()
    const { data: submissions, error } = await admin
      .from('kyc_submissions')
      .select(
        'id, user_id, full_name, id_type, id_number, id_document_url, face_video_url, status, submitted_at, user:profiles(full_name, avatar_url, role)',
      )
      .eq('status', 'pending')
      .order('submitted_at', { ascending: true })
      .limit(50)

    if (error) {
      return NextResponse.json(
        { error: 'Could not load KYC submissions' },
        { status: 500 },
      )
    }

    const data = await Promise.all(
      (submissions ?? []).map(async (submission) => {
        const idPath = getUserStoragePath(
          submission.id_document_url,
          submission.user_id,
        )
        const videoPath = getUserStoragePath(
          submission.face_video_url,
          submission.user_id,
        )
        const [idDocument, faceVideo] = await Promise.all([
          idPath
            ? admin.storage.from('kyc-documents').createSignedUrl(idPath, 300)
            : Promise.resolve({ data: null }),
          videoPath
            ? admin.storage
                .from('kyc-documents')
                .createSignedUrl(videoPath, 300)
            : Promise.resolve({ data: null }),
        ])

        return {
          ...submission,
          id_document_url: idDocument.data?.signedUrl ?? null,
          face_video_url: faceVideo.data?.signedUrl ?? null,
        }
      }),
    )

    return NextResponse.json({ submissions: data })
  } catch {
    return NextResponse.json(
      { error: 'Could not load KYC submissions' },
      { status: 500 },
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await getAdminUser()
    if (!user) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const parsed = reviewSchema.safeParse(await request.json())
    if (
      !parsed.success ||
      (!parsed.data.approved && !parsed.data.rejection_reason)
    ) {
      return NextResponse.json(
        { error: 'A rejection reason is required' },
        { status: 400 },
      )
    }

    const admin = createAdminClient()
    const { data: submission } = await admin
      .from('kyc_submissions')
      .select('id, user_id')
      .eq('id', parsed.data.id)
      .eq('status', 'pending')
      .maybeSingle()
    if (!submission) {
      return NextResponse.json(
        { error: 'Pending submission not found' },
        { status: 404 },
      )
    }

    const approved = parsed.data.approved
    const { data: reviewed, error: reviewError } = await admin
      .from('kyc_submissions')
      .update({
        status: approved ? 'approved' : 'rejected',
        rejection_reason: approved ? null : parsed.data.rejection_reason,
        reviewed_at: new Date().toISOString(),
        reviewed_by: user.id,
      })
      .eq('id', submission.id)
      .eq('status', 'pending')
      .select('id')
      .maybeSingle()

    if (reviewError || !reviewed) {
      return NextResponse.json(
        { error: 'Submission was already reviewed' },
        { status: 409 },
      )
    }

    const { error: profileError } = await admin
      .from('profiles')
      .update({
        kyc_status: approved ? 'verified' : 'rejected',
        is_verified: approved,
      })
      .eq('id', submission.user_id)

    if (profileError) {
      return NextResponse.json(
        { error: 'Review recorded, but profile status needs reconciliation' },
        { status: 500 },
      )
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json(
      { error: 'Could not review KYC submission' },
      { status: 500 },
    )
  }
}
