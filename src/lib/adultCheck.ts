import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { ageGate, type AgeGate } from '@/lib/ageGate'

// Server-side check of the adult confirmation for one or more members.
// Uses the service-role client, so it can read a column ordinary members cannot.
// If the database does not have the column yet (migration not applied) every member
// is reported as 'not_enforced' rather than breaking the feature that asked.
export async function adultStates(
  admin: SupabaseClient,
  ids: string[],
): Promise<Map<string, AgeGate>> {
  const result = new Map<string, AgeGate>()
  const { data, error } = await admin
    .from('profiles')
    .select('id, age_confirmed_at')
    .in('id', ids)
  if (error) {
    for (const id of ids) result.set(id, 'not_enforced')
    return result
  }
  for (const id of ids) result.set(id, 'required') // unknown member: not confirmed
  for (const row of data ?? []) {
    result.set(
      row.id as string,
      ageGate((row as { age_confirmed_at?: string | null }).age_confirmed_at),
    )
  }
  return result
}
