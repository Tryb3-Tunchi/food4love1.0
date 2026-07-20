'use client'
import { useEffect, useState } from 'react'
import { getAllUsers, suspendUser } from '@/services/admin'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Search } from 'lucide-react'
import toast from 'react-hot-toast'

export default function AdminUsersPage() {
  const [users, setUsers] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const t = setTimeout(() => {
      getAllUsers(search || undefined)
        .then(setUsers)
        .finally(() => setLoading(false))
    }, 300)
    return () => clearTimeout(t)
  }, [search])

  return (
    <div className="mx-auto min-h-screen max-w-5xl bg-char p-6">
      <h1 className="mb-6 text-2xl font-bold text-white">User Management</h1>
      <div className="mb-4">
        <Input
          placeholder="Search users..."
          leftIcon={<Search className="h-4 w-4" />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <div className="space-y-2">
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
                await suspendUser(u.id, !(u as any).suspended)
                toast.success('Updated')
                setUsers((p) =>
                  p.map((x) =>
                    x.id === u.id
                      ? { ...x, suspended: !(u as any).suspended }
                      : x,
                  ),
                )
              }}
            >
              {(u as any).suspended ? 'Unsuspend' : 'Suspend'}
            </Button>
          </div>
        ))}
      </div>
    </div>
  )
}
