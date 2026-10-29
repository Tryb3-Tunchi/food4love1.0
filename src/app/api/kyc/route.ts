import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const submissionSchema = z.object({
  id_type: z.enum(['nin', 'bvn', 'passport', 'drivers_license']),
  id_number: z.string().trim().min(3).max(100),
  id_document_path: z.string().min(1).max(1000),
  face_video_path: z.string().min(1).max(1000),
})

function belongsToUser(path: string, userId: string) {
  return path.startsWith(`${userId}/`) && !path.includes('..')
}

export async function POST(request: NextRequest) {
  try {
    const session = await createClient()
    const {
      data: { user },
    } = await session.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const parsed = submissionSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid KYC submission' },
        { status: 400 },
      )
    }
    if (
      !belongsToUser(parsed.data.id_document_path, user.id) ||
      !belongsToUser(parsed.data.face_video_path, user.id)
    ) {
      return NextResponse.json(
        { error: 'Invalid document paths' },
        { status: 400 },
      )
    }

    const admin = createAdminClient()
    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('full_name, role, kyc_status, suspended')
      .eq('id', user.id)
      .maybeSingle()

    if (profileError) {
      return NextResponse.json(
        { error: 'Could not verify cook account status' },
        { status: 500 },
      )
    }
    if (!profile || profile.role !== 'cook' || profile.suspended) {
      return NextResponse.json(
        { error: 'Cook account is not eligible' },
        { status: 403 },
      )
    }
    if (profile.kyc_status === 'verified') {
      return NextResponse.json(
        { error: 'This cook is already verified' },
        { status: 409 },
      )
    }

    const { data: existing, error: existingError } = await admin
      .from('kyc_submissions')
      .select('id')
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .maybeSingle()
    if (existingError) {
      return NextResponse.json(
        { error: 'Could not check for an existing KYC submission' },
        { status: 500 },
      )
    }
    if (existing) {
      return NextResponse.json(
        { error: 'A KYC submission is already under review' },
        { status: 409 },
      )
    }

    const { data: submission, error } = await admin
      .from('kyc_submissions')
      .insert({
        user_id: user.id,
        full_name: profile.full_name,
        id_type: parsed.data.id_type,
        id_number: parsed.data.id_number,
        id_document_url: parsed.data.id_document_path,
        face_video_url: parsed.data.face_video_path,
        status: 'pending',
      })
      .select('id, status')
      .single()

    if (error || !submission) {
      return NextResponse.json(
        {
          error:
            error?.code === '23505'
              ? 'A KYC submission is already under review'
              : 'Could not save KYC submission',
        },
        { status: error?.code === '23505' ? 409 : 500 },
      )
    }

    const { error: statusError } = await admin
      .from('profiles')
      .update({ kyc_status: 'pending' })
      .eq('id', user.id)
    if (statusError) {
      const { error: cleanupError } = await admin
        .from('kyc_submissions')
        .delete()
        .eq('id', submission.id)
      if (cleanupError) {
        return NextResponse.json(
          {
            error:
              'Your submission was saved, but its account status needs support review',
          },
          { status: 500 },
        )
      }
      return NextResponse.json(
        { error: 'Could not update cook verification status' },
        { status: 500 },
      )
    }

    return NextResponse.json({ submission }, { status: 201 })
  } catch {
    return NextResponse.json(
      { error: 'Could not submit KYC details' },
      { status: 500 },
    )
  }
}
