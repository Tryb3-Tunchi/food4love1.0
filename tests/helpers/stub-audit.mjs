// Stands in for src/lib/admin/audit.ts during tests: records what would have been written.
// Set globalThis.__f4lAuditDown = true to simulate the audit table being unavailable.
export const auditLog = (globalThis.__f4lAudit ??= [])

export async function beginAdminAudit(input) {
  if (globalThis.__f4lAuditDown)
    throw new Error('Admin audit logging is unavailable')
  const entry = {
    id: `audit-${auditLog.length + 1}`,
    ...input,
    outcome: 'started',
  }
  auditLog.push(entry)
  return { admin: globalThis.__f4lFakeAdmin, auditId: entry.id }
}

export async function finishAdminAudit(_admin, auditId, outcome, errorMessage) {
  const entry = auditLog.find((item) => item.id === auditId)
  if (entry) {
    entry.outcome = outcome
    entry.error_message = errorMessage ?? null
  }
}
