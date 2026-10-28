'use client'

import { useEffect, useState } from 'react'
import { Search, ShieldCheck } from 'lucide-react'
import toast from 'react-hot-toast'

const permissionOptions = [
  ['kyc:review', 'KYC review and document access'],
  ['users:manage', 'Search, suspend, and reactivate users'],
  ['matches:manage', 'Manage matches and swipe activity'],
  ['disputes:manage', 'Review and resolve disputes'],
  ['bookings:manage', 'View booking and payment status'],
  ['finance:refund', 'Request and reconcile Paystack refunds'],
  ['listings:manage', 'Remove and restore meal specials'],
  ['messages:manage', 'Access support conversations and send staff messages'],
  ['reports:manage', 'Review and resolve user reports'],
  ['audit:view', 'View staff action audit log'],
  ['admin:manage', 'Grant and revoke staff access'],
] as const

type Permission = (typeof permissionOptions)[number][0]

interface StaffUser {
  id: string
  email: string
  full_name: string
  role: string
  is_admin: boolean
  admin_permissions: Permission[]
}

export default function AdminAccessPage() {
  const [users, setUsers] = useState<StaffUser[]>([])
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)
  const [permissions, setPermissions] = useState<Permission[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const selected = users.find((user) => user.id === selectedId)

  async function loadUsers(query = '') {
    setLoading(true)
    try {
      const response = await fetch(
        `/api/admin/access?search=${encodeURIComponent(query)}`,
        { cache: 'no-store' },
      )
      const result = await response.json()
      if (!response.ok)
        throw new Error(result.error || 'Could not load accounts')
      setUsers(result.users ?? [])
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Could not load accounts',
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadUsers()
  }, [])

  useEffect(() => {
    if (!selected) return
    setIsAdmin(selected.is_admin)
    setPermissions(selected.admin_permissions)
  }, [selectedId, users])

  async function saveAccess() {
    if (!selected) return
    if (isAdmin && permissions.length === 0) {
      toast.error('Choose at least one permission for this admin')
      return
    }
    if (
      selected.is_admin &&
      !isAdmin &&
      !window.confirm(`Revoke admin access for ${selected.email}?`)
    )
      return

    setSaving(true)
    try {
      const response = await fetch('/api/admin/access', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: selected.id,
          is_admin: isAdmin,
          admin_permissions: permissions,
        }),
      })
      const result = await response.json()
      if (!response.ok)
        throw new Error(result.error || 'Could not update access')
      toast.success(
        isAdmin
          ? 'Administrator access updated'
          : 'Administrator access revoked',
      )
      await loadUsers(search)
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Could not update access',
      )
    } finally {
      setSaving(false)
    }
  }

  function togglePermission(permission: Permission) {
    setPermissions((current) =>
      current.includes(permission)
        ? current.filter((value) => value !== permission)
        : [...current, permission],
    )
  }

  return (
    <div className="mx-auto min-h-screen max-w-6xl bg-char p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-white">Staff access</h1>
        <p className="mt-1 text-sm text-mist">
          Grant trusted admin access and only the operational permissions each
          staff member needs.
        </p>
      </header>
      <div className="grid gap-6 lg:grid-cols-[minmax(260px,0.8fr)_1.2fr]">
        <section className="border-y border-white/10">
          <label className="relative block border-b border-white/10">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mist" />
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value)
                void loadUsers(event.target.value)
              }}
              placeholder="Find by name or email"
              className="w-full bg-transparent py-3 pl-10 pr-3 text-sm text-white outline-none placeholder:text-mist"
            />
          </label>
          <div className="max-h-[65vh] overflow-y-auto">
            {users.map((user) => (
              <button
                key={user.id}
                onClick={() => setSelectedId(user.id)}
                className={`block w-full border-b border-white/5 px-4 py-3 text-left ${user.id === selectedId ? 'bg-white/10' : 'hover:bg-white/5'}`}
              >
                <span className="block truncate text-sm font-medium text-white">
                  {user.full_name || user.email}
                </span>
                <span className="block truncate text-xs text-mist">
                  {user.email} · {user.role}
                </span>
                {user.is_admin && (
                  <span className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold uppercase text-emerald-300">
                    <ShieldCheck className="h-3 w-3" />
                    Admin
                  </span>
                )}
              </button>
            ))}
            {!loading && users.length === 0 && (
              <p className="p-4 text-sm text-mist">No accounts found.</p>
            )}
          </div>
        </section>
        <section className="min-w-0">
          {!selected ? (
            <p className="py-8 text-sm text-mist">
              Select an account to review its access.
            </p>
          ) : (
            <>
              <div className="mb-5 border-b border-white/10 pb-4">
                <h2 className="font-semibold text-white">
                  {selected.full_name || selected.email}
                </h2>
                <p className="mt-1 text-sm text-mist">
                  {selected.email} · {selected.role}
                </p>
              </div>
              <label className="mb-4 flex items-center gap-3 border-b border-white/10 pb-4 text-sm font-medium text-white">
                <input
                  type="checkbox"
                  checked={isAdmin}
                  onChange={(event) => setIsAdmin(event.target.checked)}
                  className="h-4 w-4 accent-emerald-500"
                />
                Administrator account
              </label>
              {isAdmin && (
                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase text-mist">
                    Permissions
                  </p>
                  {permissionOptions.map(([permission, description]) => (
                    <label
                      key={permission}
                      className="flex items-start gap-3 text-sm text-white/80"
                    >
                      <input
                        type="checkbox"
                        checked={permissions.includes(permission)}
                        onChange={() => togglePermission(permission)}
                        className="mt-0.5 h-4 w-4 accent-emerald-500"
                      />
                      <span>
                        <span className="block font-medium text-white">
                          {permission}
                        </span>
                        <span className="text-xs text-mist">{description}</span>
                      </span>
                    </label>
                  ))}
                </div>
              )}
              <button
                onClick={saveAccess}
                disabled={saving}
                className="mt-6 rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save staff access'}
              </button>
            </>
          )}
        </section>
      </div>
    </div>
  )
}
