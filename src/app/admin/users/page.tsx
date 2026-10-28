'use client'
import { useEffect, useState } from 'react'
import { getAllUsers, suspendUser } from '@/services/admin'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Search } from 'lucide-react'
import toast from 'react-hot-toast'
import { useSearchParams } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'

const PAGE_SIZE = 25

export default function AdminUsersPage() {
  const searchParams = useSearchParams()
  const [users, setUsers] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [role, setRole] = useState<'all' | 'buyer' | 'cook'>('all')
  const [status, setStatus] = useState<'all' | 'suspended'>('all')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const requestedRole = searchParams.get('role')
    setRole(
      requestedRole === 'buyer' || requestedRole === 'cook'
        ? requestedRole
        : 'all',
    )
    setStatus(searchParams.get('status') === 'suspended' ? 'suspended' : 'all')
  }, [searchParams])

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    const t = setTimeout(async () => {
      try {
        const result = await getAllUsers(
          search || undefined,
          role === 'all' ? undefined : role,
          status === 'all' ? undefined : status,
          page,
          PAGE_SIZE,
        )
        if (active) {
          setUsers(result.users ?? [])
          setTotal(result.total ?? 0)
        }
      } catch (cause) {
        const message =
          cause instanceof Error ? cause.message : 'Could not load users'
        if (active) {
          setError(message)
          toast.error(message)
        }
      } finally {
        if (active) setLoading(false)
      }
    }, 300)
    return () => {
      active = false
      clearTimeout(t)
    }
  }, [page, role, search, status])

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="mx-auto min-h-screen max-w-5xl bg-char p-6">
      <h1 className="mb-2 text-2xl font-bold text-white">Users and cooks</h1>
      <p className="mb-6 text-sm text-mist">
        Search marketplace accounts and manage account access.
      </p>
      <div className="mb-4 grid gap-3 sm:grid-cols-[minmax(14rem,1fr)_auto_auto]">
        <Input
          placeholder="Search by name..."
          leftIcon={<Search className="h-4 w-4" />}
          value={search}
          onChange={(e) => {
            setPage(1)
            setSearch(e.target.value)
          }}
        />
        <label className="sr-only" htmlFor="admin-user-role">
          Filter accounts by role
        </label>
        <select
          id="admin-user-role"
          value={role}
          onChange={(event) => {
            setPage(1)
            setRole(event.target.value as 'all' | 'buyer' | 'cook')
          }}
          className="min-h-11 rounded-lg border border-white/10 bg-smoke px-3 text-sm text-white outline-none focus:border-[var(--accent)]"
        >
          <option value="all">All roles</option>
          <option value="buyer">Buyers</option>
          <option value="cook">Home cooks</option>
        </select>
        <label className="sr-only" htmlFor="admin-user-status">
          Filter accounts by status
        </label>
        <select
          id="admin-user-status"
          value={status}
          onChange={(event) => {
            setPage(1)
            setStatus(event.target.value as 'all' | 'suspended')
          }}
          className="min-h-11 rounded-lg border border-white/10 bg-smoke px-3 text-sm text-white outline-none focus:border-[var(--accent)]"
        >
          <option value="all">All account statuses</option>
          <option value="suspended">Suspended accounts</option>
        </select>
      </div>
      <div className="space-y-2">
        {loading && <p className="text-sm text-mist">Loading users...</p>}
        {!loading && error && (
          <div
            role="alert"
            className="rounded-lg bg-red-500/10 p-4 text-sm text-red-700 dark:text-red-300"
          >
            {error}
          </div>
        )}
        {users.map((u) => (
          <div
            key={u.id}
            className="flex items-center gap-3 rounded-xl border border-white/5 bg-smoke p-4"
          >
            <Avatar
              src={u.avatar_url}
              name={u.full_name}
              size="md"
              verified={u.is_verified}
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-medium text-white">
                  {u.full_name}
                </span>
                <Badge
                  variant={u.role === 'cook' ? 'ember' : 'muted'}
                  size="sm"
                >
                  {u.role}
                </Badge>
                {u.kyc_status === 'verified' && (
                  <Badge variant="success" size="sm">
                    ✓ KYC
                  </Badge>
                )}
                {(u as any).suspended && (
                  <Badge
                    variant="default"
                    size="sm"
                    className="border-red-400/20 bg-red-500/20 text-red-400"
                  >
                    Suspended
                  </Badge>
                )}
              </div>
              <p className="text-xs text-mist">
                {u.location ?? 'No location'} · Joined{' '}
                {new Date(u.created_at).toLocaleDateString()}
              </p>
            </div>
            <Button
              variant="ghost"
              size="xs"
              className="text-red-400 hover:bg-red-900/20 hover:text-red-300"
              onClick={async () => {
                const suspended = !(u as any).suspended
                const reason = window.prompt(
                  `${suspended ? 'Reason for suspension' : 'Reason for reactivation'}:`,
                )
                if (!reason?.trim()) return
                try {
                  await suspendUser(u.id, suspended, reason.trim())
                  toast.success(
                    suspended ? 'User suspended' : 'User reactivated',
                  )
                  if (status === 'suspended' && !suspended) {
                    setUsers((current) =>
                      current.filter((item) => item.id !== u.id),
                    )
                    setTotal((current) => Math.max(0, current - 1))
                    if (users.length === 1 && page > 1) {
                      setPage((current) => current - 1)
                    }
                  } else {
                    setUsers((current) =>
                      current.map((item) =>
                        item.id === u.id ? { ...item, suspended } : item,
                      ),
                    )
                  }
                } catch (error) {
                  toast.error(
                    error instanceof Error
                      ? error.message
                      : 'Could not update user',
                  )
                }
              }}
            >
              {(u as any).suspended ? 'Reactivate' : 'Suspend'}
            </Button>
          </div>
        ))}
        {!loading && !error && users.length === 0 && (
          <p className="rounded-xl border border-white/10 bg-smoke p-8 text-center text-sm text-mist">
            No accounts match these filters.
          </p>
        )}
      </div>
      {!loading && !error && total > 0 && (
        <footer className="mt-4 flex items-center justify-between border-t border-white/10 pt-3 text-xs text-mist">
          <span>
            {Math.min((page - 1) * PAGE_SIZE + 1, total)}–
            {Math.min(page * PAGE_SIZE, total)} of {total} accounts
          </span>
          <div className="flex items-center gap-2">
            <span>
              Page {page} of {pageCount}
            </span>
            <button
              type="button"
              aria-label="Previous account page"
              disabled={page <= 1 || loading}
              onClick={() => setPage((current) => current - 1)}
              className="rounded-md p-2 text-[var(--admin-text)] hover:bg-[var(--admin-hover)] disabled:opacity-40"
            >
              <ChevronLeft aria-hidden="true" className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label="Next account page"
              disabled={page >= pageCount || loading}
              onClick={() => setPage((current) => current + 1)}
              className="rounded-md p-2 text-[var(--admin-text)] hover:bg-[var(--admin-hover)] disabled:opacity-40"
            >
              <ChevronRight aria-hidden="true" className="h-4 w-4" />
            </button>
          </div>
        </footer>
      )}
    </div>
  )
}
