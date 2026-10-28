import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'

export async function beginAdminAudit(input: {
  actorId: string
  action: string
  targetType: string
  targetId: string
  details: Record<string, unknown>
}) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('admin_audit_log')
    .insert({
      actor_id: input.actorId,
      action: input.action,
      target_type: input.targetType,
      target_id: input.targetId,
      details: input.details,
      outcome: 'started',
    })
    .select('id')
    .single()

  if (error || !data) throw new Error('Admin audit logging is unavailable')
  return { admin, auditId: data.id }
}

export async function finishAdminAudit(
  admin: ReturnType<typeof createAdminClient>,
  auditId: string,
  outcome: 'succeeded' | 'failed',
  errorMessage?: string,
) {
  const { error } = await admin
    .from('admin_audit_log')
    .update({ outcome, error_message: errorMessage ?? null })
    .eq('id', auditId)

  if (error) throw new Error('Admin audit outcome could not be recorded')
}
