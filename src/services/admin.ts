export async function getAdminStats() {
  const response = await fetch('/api/admin/overview', { cache: 'no-store' })
  const result = await response.json().catch(() => ({}))
  if (!response.ok)
    throw new Error(result.error || 'Could not load admin overview')
  return result
}

export async function getAllUsers(search?: string) {
  const params = new URLSearchParams()
  if (search) params.set('search', search)
  const response = await fetch(`/api/admin/users?${params.toString()}`, {
    cache: 'no-store',
  })
  const result = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(result.error || 'Could not load users')
  return result.users ?? []
}

export async function suspendUser(
  userId: string,
  suspended: boolean,
  reason: string,
) {
  const response = await fetch(`/api/admin/users/${userId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ suspended, reason }),
  })
  const result = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(result.error || 'Could not update user')
  return result.user
}
