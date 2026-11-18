// Stands in for src/lib/supabase/admin.ts during tests. The only client it can return is the
// in-memory fake a test installed; with none installed it throws, never connecting anywhere.
export function createAdminClient() {
  if (!globalThis.__f4lFakeAdmin)
    throw new Error('Test harness: no fake admin client installed')
  return globalThis.__f4lFakeAdmin
}
