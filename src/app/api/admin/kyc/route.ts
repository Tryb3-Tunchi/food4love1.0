import { createAdminClient } from '@/lib/supabase/admin'
import { getAdminUser } from '@/lib/admin/auth'
import { beginAdminAudit, finishAdminAudit } from '@/lib/admin/audit'
import { resolveAppUrl } from '@/lib/appUrl'
import { processInterestEmails } from '@/lib/notifications/interestEmails'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const reviewSchema = z.object({
  id: z.string().uuid(),
  approved: z.boolean(),
  reason: z.string().trim().min(5).max(1000),
})

const revokeSchema = z.object({
  cook_id: z.string().uuid(),
  reason: z.string().trim().min(5).max(1000),
})

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
    const user = await getAdminUser('kyc:review')
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

    const auditEntries: Awaited<ReturnType<typeof beginAdminAudit>>[] = []
    for (const submission of submissions ?? []) {
      try {
        auditEntries.push(
          await beginAdminAudit({
            actorId: user.id,
            action: 'kyc.documents_accessed',
            targetType: 'kyc_submission',
            targetId: submission.id,
            details: { signed_url_ttl_seconds: 300 },
          }),
        )
      } catch {
        return NextResponse.json(
          { error: 'KYC access audit logging is unavailable' },
          { status: 503 },
        )
      }
    }

    const data = await Promise.all(
      (submissions ?? []).map(async (submission, index) => {
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
            : Promise.resolve({ data: null, error: null }),
          videoPath
            ? admin.storage
                .from('kyc-documents')
                .createSignedUrl(videoPath, 300)
            : Promise.resolve({ data: null, error: null }),
        ])

        await finishAdminAudit(
          auditEntries[index].admin,
          auditEntries[index].auditId,
          idDocument.data?.signedUrl || faceVideo.data?.signedUrl
            ? 'succeeded'
            : 'failed',
          idDocument.error?.message ?? faceVideo.error?.message,
        )

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
    const user = await getAdminUser('kyc:review')
    if (!user) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const parsed = reviewSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'A review reason of at least five characters is required' },
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

    const audit = await beginAdminAudit({
      actorId: user.id,
      action: parsed.data.approved ? 'kyc.approve' : 'kyc.reject',
      targetType: 'kyc_submission',
      targetId: submission.id,
      details: { approved: parsed.data.approved, reason: parsed.data.reason },
    }).catch(() => null)
    if (!audit) {
      return NextResponse.json(
        { error: 'KYC review audit logging is unavailable' },
        { status: 503 },
      )
    }

    const approved = parsed.data.approved
    const { data: reviewed, error: reviewError } = await admin
      .from('kyc_submissions')
      .update({
        status: approved ? 'approved' : 'rejected',
        rejection_reason: approved ? null : parsed.data.reason,
        reviewed_at: new Date().toISOString(),
        reviewed_by: user.id,
      })
      .eq('id', submission.id)
      .eq('status', 'pending')
      .select('id')
      .maybeSingle()

    if (reviewError || !reviewed) {
      await finishAdminAudit(
        audit.admin,
        audit.auditId,
        'failed',
        reviewError?.message ?? 'Submission was already reviewed',
      )
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
      await finishAdminAudit(
        audit.admin,
        audit.auditId,
        'failed',
        'Review recorded, profile status needs reconciliation',
      )
      return NextResponse.json(
        { error: 'Review recorded, but profile status needs reconciliation' },
        { status: 500 },
      )
    }

    await finishAdminAudit(audit.admin, audit.auditId, 'succeeded')

    // The database has already written the in-app notifications and queued the emails for
    // customers who asked to be told (it watches kyc_status, so that happens however a cook
    // becomes verified). Send what is queued for THIS cook now. Best effort and time-boxed:
    // approving a cook must never wait on, or fail because of, email. Anything not finished
    // stays queued and is picked up by the email retry.
    if (approved) {
      try {
        await Promise.race([
          processInterestEmails(admin, {
            appUrl: resolveAppUrl(request.nextUrl.origin),
            cookId: submission.user_id,
          }),
          new Promise((resolve) => setTimeout(resolve, 8000)),
        ])
      } catch {
        // see above
      }
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json(
      { error: 'Could not review KYC submission' },
      { status: 500 },
    )
  }
}

// Take back an approval (for example a cook's circumstances changed, or a document was
// found to be false). Permission-controlled and audited. The cook returns to
// "unverified": they can no longer accept bookings (the database refuses it too) and can
// apply again. Existing records and documents are kept. The cook is notified by the
// database when their verification changes.
export async function POST(request: NextRequest) {
  try {
    const user = await getAdminUser('kyc:review')
    if (!user) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const parsed = revokeSchema.safeParse(
      await request.json().catch(() => null),
    )
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'A reason of at least five characters is required' },
        { status: 400 },
      )
    }

    const admin = createAdminClient()
    const { data: cook } = await admin
      .from('profiles')
      .select('id, role, kyc_status')
      .eq('id', parsed.data.cook_id)
      .maybeSingle()
    if (!cook || cook.role !== 'cook') {
      return NextResponse.json({ error: 'Cook not found' }, { status: 404 })
    }
    if (cook.kyc_status !== 'verified') {
      return NextResponse.json(
        { error: 'Only a verified cook can have verification revoked' },
        { status: 409 },
      )
    }

    const audit = await beginAdminAudit({
      actorId: user.id,
      action: 'kyc.revoke',
      targetType: 'profile',
      targetId: cook.id,
      details: { reason: parsed.data.reason },
    }).catch(() => null)
    if (!audit) {
      return NextResponse.json(
        { error: 'KYC audit logging is unavailable' },
        { status: 503 },
      )
    }

    const { data: updated, error } = await admin
      .from('profiles')
      .update({ kyc_status: 'unverified', is_verified: false })
      .eq('id', cook.id)
      .eq('kyc_status', 'verified') // only if still verified (no double revoke)
      .select('id')
      .maybeSingle()
    if (error || !updated) {
      await finishAdminAudit(
        audit.admin,
        audit.auditId,
        'failed',
        error?.message ?? 'Verification changed before it could be revoked',
      )
      return NextResponse.json(
        { error: 'Verification changed before it could be revoked' },
        { status: 409 },
      )
    }
    await finishAdminAudit(audit.admin, audit.auditId, 'succeeded')
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json(
      { error: 'Could not revoke verification' },
      { status: 500 },
    )
  }
}
