// An in-memory stand-in for the parts of Supabase and Resend that Food4Love's server code
// uses, so the REAL server modules can be run in tests without any network or database.
//
// It models what the migrations enforce (unique indexes, the invitation status trigger),
// because several behaviours under test (double clicks, repeated approvals, revoke races)
// are only correct BECAUSE the database says no. It is deliberately small: just the query
// operators the code actually calls.

import { randomUUID } from 'node:crypto'

const nowIso = () => new Date().toISOString()

function pick(row, cols) {
  if (!cols || cols === '*' || cols.includes('(')) return { ...row }
  const out = {}
  for (const col of cols
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean))
    out[col] = row[col]
  return out
}

class Query {
  constructor(db, table) {
    this.db = db
    this.table = table
    this.op = 'select'
    this.filters = []
    this.payload = null
    this.cols = '*'
    this.returning = false
    this.opts = {}
    this.mode = 'many'
    this.sort = null
    this.max = null
  }
  select(cols = '*', opts = {}) {
    this.cols = cols
    this.opts = opts
    if (this.op !== 'select') this.returning = true
    return this
  }
  insert(payload) {
    this.op = 'insert'
    this.payload = payload
    return this
  }
  update(payload) {
    this.op = 'update'
    this.payload = payload
    return this
  }
  upsert(payload, opts = {}) {
    this.op = 'upsert'
    this.payload = payload
    this.upsertOpts = opts
    return this
  }
  delete() {
    this.op = 'delete'
    return this
  }
  eq(col, val) {
    this.filters.push((r) => (val === null ? r[col] == null : r[col] === val))
    return this
  }
  neq(col, val) {
    this.filters.push((r) => r[col] !== val)
    return this
  }
  in(col, vals) {
    this.filters.push((r) => vals.includes(r[col]))
    return this
  }
  lt(col, val) {
    this.filters.push((r) => r[col] != null && r[col] < val)
    return this
  }
  lte(col, val) {
    this.filters.push((r) => r[col] != null && r[col] <= val)
    return this
  }
  gt(col, val) {
    this.filters.push((r) => r[col] != null && r[col] > val)
    return this
  }
  gte(col, val) {
    this.filters.push((r) => r[col] != null && r[col] >= val)
    return this
  }
  is(col, val) {
    this.filters.push((r) => (val === null ? r[col] == null : r[col] === val))
    return this
  }
  or(expr) {
    const parts = expr.split(',').map((part) => {
      const [col, op, ...rest] = part.split('.')
      const value = rest.join('.')
      return (r) => {
        if (op === 'is')
          return value === 'null' ? r[col] == null : String(r[col]) === value
        if (op === 'eq') return String(r[col]) === value
        if (op === 'lt') return r[col] != null && r[col] < value
        if (op === 'lte') return r[col] != null && r[col] <= value
        if (op === 'gt') return r[col] != null && r[col] > value
        if (op === 'gte') return r[col] != null && r[col] >= value
        if (op === 'ilike') {
          const needle = value.replace(/%/g, '').toLowerCase()
          return String(r[col] ?? '')
            .toLowerCase()
            .includes(needle)
        }
        return false
      }
    })
    this.filters.push((r) => parts.some((test) => test(r)))
    return this
  }
  order(col, { ascending = true } = {}) {
    this.sort = { col, ascending }
    return this
  }
  limit(n) {
    this.max = n
    return this
  }
  range(from, to) {
    this.rangeFrom = from
    this.rangeTo = to
    return this
  }
  single() {
    this.mode = 'single'
    return this
  }
  maybeSingle() {
    this.mode = 'maybe'
    return this
  }
  then(resolve, reject) {
    return Promise.resolve(this.run()).then(resolve, reject)
  }

  run() {
    const db = this.db
    // a table the migration has not created yet, exactly as PostgREST reports it
    if (db.config[this.table]?.missing)
      return {
        data: null,
        count: null,
        error: {
          code: 'PGRST205',
          message: `Could not find the table 'public.${this.table}' in the schema cache`,
        },
      }
    const rows = db.rows(this.table)
    const matches = (r) => this.filters.every((f) => f(r))
    let touched = []
    let error = null
    let count = null

    if (this.op === 'select') {
      let out = rows.filter(matches)
      count = out.length
      if (this.sort) {
        const { col, ascending } = this.sort
        out = [...out].sort(
          (a, b) =>
            (a[col] > b[col] ? 1 : a[col] < b[col] ? -1 : 0) *
            (ascending ? 1 : -1),
        )
      }
      if (this.rangeFrom !== undefined)
        out = out.slice(this.rangeFrom, this.rangeTo + 1)
      if (this.max !== null) out = out.slice(0, this.max)
      touched = out
    } else if (this.op === 'insert' || this.op === 'upsert') {
      const items = Array.isArray(this.payload) ? this.payload : [this.payload]
      for (const item of items) {
        const base = {
          id: randomUUID(),
          created_at: nowIso(),
          updated_at: nowIso(),
          ...(db.config[this.table]?.defaults ?? {}),
        }
        const row = { ...base, ...item }
        if (this.op === 'upsert' && this.upsertOpts?.onConflict) {
          const keys = this.upsertOpts.onConflict.split(',')
          const existing = rows.find((r) => keys.every((k) => r[k] === row[k]))
          if (existing) {
            if (!this.upsertOpts.ignoreDuplicates) Object.assign(existing, item)
            continue
          }
        }
        const violation = db.violation(this.table, row, null)
        if (violation) {
          error = violation
          break
        }
        rows.push(row)
        touched.push(row)
      }
    } else if (this.op === 'update') {
      for (const target of rows.filter(matches)) {
        const next = { ...target, ...this.payload }
        const hook = db.config[this.table]?.beforeUpdate?.(target, next)
        if (hook) {
          error = hook
          break
        }
        const violation = db.violation(this.table, next, target)
        if (violation) {
          error = violation
          break
        }
        Object.assign(target, next)
        touched.push(target)
      }
    } else if (this.op === 'delete') {
      const keep = rows.filter((r) => !matches(r))
      touched = rows.filter(matches)
      rows.length = 0
      rows.push(...keep)
    }

    if (error) return { data: null, error, count: null }

    const wantsRows = this.op === 'select' || this.returning
    let data = wantsRows ? touched.map((r) => pick(r, this.cols)) : null
    if (this.opts?.head) data = null
    if (this.mode === 'single') {
      if (touched.length !== 1)
        return {
          data: null,
          error: {
            code: 'PGRST116',
            message: 'JSON object requested, multiple (or no) rows returned',
          },
          count,
        }
      data = data[0]
    } else if (this.mode === 'maybe') {
      if (touched.length > 1)
        return {
          data: null,
          error: { code: 'PGRST116', message: 'multiple rows returned' },
          count,
        }
      data = data ? (data[0] ?? null) : null
    }
    return { data, error: null, count: this.opts?.count ? count : null }
  }
}

class FakeAuthAdmin {
  constructor(db) {
    this.db = db
    this.users = []
    this.tokens = new Map()
    this.failNext = null // { code, status, message }: makes the next generateLink fail
    this.calls = []
  }
  _create({ email, data }) {
    const user = {
      id: randomUUID(),
      email,
      email_confirmed_at: null,
      last_sign_in_at: null,
      app_metadata: { provider: 'email' },
      user_metadata: { ...data },
      has_password: false,
    }
    this.users.push(user)
    // the signup trigger
    if (this.db.config.autoProfile !== false) {
      this.db.rows('profiles').push({
        id: user.id,
        full_name: data?.full_name ?? email.split('@')[0],
        role: data?.role === 'cook' ? 'cook' : 'buyer',
        onboarding_complete: false,
        kyc_status: 'unverified',
        suspended: false,
        created_at: nowIso(),
      })
    }
    return user
  }
  async generateLink({ type, email, options }) {
    this.calls.push({ type, email })
    if (this.failNext) {
      const error = this.failNext
      this.failNext = null
      return { data: { user: null, properties: null }, error }
    }
    let user = this.users.find((u) => u.email === email)
    if (type === 'invite') {
      if (user?.email_confirmed_at)
        return {
          data: { user: null, properties: null },
          error: {
            code: 'email_exists',
            status: 422,
            message:
              'A user with this email address has already been registered',
          },
        }
      if (!user) user = this._create({ email, data: options?.data })
      else Object.assign(user.user_metadata, options?.data ?? {})
    } else if (type === 'magiclink') {
      if (!user)
        return {
          data: { user: null, properties: null },
          error: {
            code: 'user_not_found',
            status: 404,
            message: 'User not found',
          },
        }
    }
    const hashed = `hash-${randomUUID()}`
    this.tokens.set(hashed, { userId: user.id, type })
    return {
      data: {
        user,
        properties: {
          hashed_token: hashed,
          verification_type: type,
          email_otp: '123456',
          action_link: 'https://supabase.invalid/verify',
        },
      },
      error: null,
    }
  }
  async getUserById(id) {
    const user = this.users.find((u) => u.id === id)
    return user
      ? { data: { user }, error: null }
      : { data: { user: null }, error: { message: 'not found' } }
  }
  async updateUserById(id, attrs) {
    const user = this.users.find((u) => u.id === id)
    if (!user) return { data: null, error: { message: 'not found' } }
    if (attrs.app_metadata)
      user.app_metadata = { ...user.app_metadata, ...attrs.app_metadata }
    return { data: { user }, error: null }
  }
  async deleteUser(id) {
    this.users = this.users.filter((u) => u.id !== id)
    const profiles = this.db.rows('profiles')
    const keep = profiles.filter((p) => p.id !== id)
    profiles.length = 0
    profiles.push(...keep)
    return { data: null, error: null }
  }
  async listUsers() {
    return { data: { users: this.users }, error: null }
  }
}

export class FakeSupabase {
  constructor(config = {}) {
    this.config = config
    this.tables = new Map()
    this.rpcHandlers = {}
    this.auth = { admin: new FakeAuthAdmin(this) }
  }
  rows(name) {
    if (!this.tables.has(name)) this.tables.set(name, [])
    return this.tables.get(name)
  }
  from(name) {
    return new Query(this, name)
  }
  async rpc(name, args) {
    const handler = this.rpcHandlers[name]
    if (!handler)
      return {
        data: null,
        error: {
          code: 'PGRST202',
          message: `Could not find the function ${name}`,
        },
      }
    return { data: handler(args), error: null }
  }
  violation(table, row, original) {
    const cfg = this.config[table]
    if (cfg?.check) {
      const message = cfg.check(row)
      if (message) return { code: '23514', message }
    }
    for (const unique of cfg?.uniques ?? []) {
      if (unique.where && !unique.where(row)) continue
      const same = (a, b) =>
        unique.key
          ? unique.key(a) === unique.key(b)
          : unique.cols.every((col) => a[col] === b[col])
      const clash = this.rows(table).some(
        (other) =>
          other !== original &&
          (!unique.where || unique.where(other)) &&
          same(other, row),
      )
      if (clash)
        return {
          code: '23505',
          message: `duplicate key value violates unique constraint "${unique.name}"`,
        }
    }
    return null
  }
}

// The same rules the migrations enforce, so tests fail if the code relies on something the
// database would not actually guarantee.
export function productionLikeConfig() {
  return {
    tester_invitations: {
      defaults: {
        status: 'pending',
        send_count: 0,
        claimed_at: null,
        failure_reason: null,
      },
      uniques: [
        {
          name: 'tester_invitations_one_pending_per_email',
          cols: ['email'],
          where: (r) => r.status === 'pending',
        },
        { name: 'tester_invitations_token_hash_key', cols: ['token_hash'] },
        {
          name: 'tester_invitations_username_in_use',
          cols: ['preferred_username'],
          where: (r) =>
            r.preferred_username != null &&
            ['pending', 'accepted'].includes(r.status),
        },
      ],
      check: (r) => {
        const ok = ['beta_tester', 'regular_user'].includes(r.access_type)
          ? r.profile_role === 'buyer'
          : r.profile_role === 'cook'
        return ok
          ? null
          : 'violates check constraint "tester_invitations_role_matches_access"'
      },
      beforeUpdate: (old, next) =>
        ['accepted', 'revoked'].includes(old.status) &&
        next.status !== old.status
          ? {
              code: '23514',
              message: `A ${old.status} invitation can not change status`,
            }
          : null,
    },
    email_deliveries: {
      defaults: { status: 'queued', attempts: 0, next_attempt_at: null },
      uniques: [
        {
          name: 'email_deliveries_kind_recipient_key_key',
          cols: ['kind', 'recipient_key'],
        },
      ],
    },
    // Resend webhook events: the unique webhook id makes a replayed delivery harmless.
    email_events: {
      uniques: [
        {
          name: 'email_events_provider_event_id_key',
          cols: ['provider_event_id'],
        },
      ],
    },
    notifications: {
      uniques: [
        {
          name: 'notifications_event_key_once',
          key: (r) => `${r.user_id}|${r.data?.event_key}`,
          where: (r) => r.data?.event_key != null,
        },
      ],
    },
    booking_interests: {
      defaults: { status: 'active', notify_when_verified: false },
      uniques: [
        {
          name: 'booking_interests_one_active_idx',
          cols: ['customer_id', 'cook_id'],
          where: (r) => r.status === 'active',
        },
      ],
    },
  }
}

// The browser-side Supabase session used by the invitation acceptance flow.
export function fakeSession(admin) {
  const session = {
    user: null,
    signedOut: false,
    auth: {
      async verifyOtp({ token_hash }) {
        const token = admin.auth.admin.tokens.get(token_hash)
        if (!token)
          return {
            data: { user: null },
            error: {
              code: 'otp_expired',
              status: 403,
              message: 'Token has expired or is invalid',
            },
          }
        admin.auth.admin.tokens.delete(token_hash) // one time
        const user = admin.auth.admin.users.find((u) => u.id === token.userId)
        user.email_confirmed_at = nowIso()
        user.last_sign_in_at = nowIso()
        session.user = user
        return { data: { user, session: {} }, error: null }
      },
      async updateUser({ password }) {
        if (!session.user)
          return { data: null, error: { message: 'not signed in' } }
        if (password.length < 8)
          return {
            data: null,
            error: { code: 'weak_password', message: 'too weak' },
          }
        session.user.has_password = true
        return { data: { user: session.user }, error: null }
      },
      async signOut() {
        session.user = null
        session.signedOut = true
        return { error: null }
      },
    },
  }
  return session
}

// A stand-in for fetch() that only answers Resend, and answers it the way Resend does: a
// repeated Idempotency-Key returns the original result instead of sending again. Any other
// URL is a bug in the test or the code, so it throws.
export function installResend(initialMode = 'ok') {
  const controller = {
    mode: initialMode,
    requests: [],
    messages: new Map(), // Idempotency-Key -> message id (the unique emails actually sent)
    failFor: new Set(), // recipient addresses the provider refuses
    failStatus: 500, // the HTTP status a refusal carries (tests set 422, 429, 403 ...)
    retryAfter: null, // value of the Retry-After header on a refusal
  }
  process.env.RESEND_API_KEY = 'test-key'
  process.env.WELCOME_FROM_EMAIL = 'Food4Love <hello@example.test>'
  process.env.RESEND_FROM_EMAIL = 'Food4Love <contact@example.test>'
  delete process.env.NEXT_PUBLIC_APP_URL

  globalThis.fetch = async (url, init = {}) => {
    if (String(url) !== 'https://api.resend.com/emails')
      throw new Error(`Test harness: unexpected network call to ${url}`)
    const body = JSON.parse(init.body)
    const key = init.headers['Idempotency-Key']
    controller.requests.push({
      key,
      to: body.to,
      subject: body.subject,
      html: body.html,
      text: body.text,
      from: body.from,
    })
    if (controller.mode === 'throw') throw new Error('network down')
    if (controller.mode === 'fail' || controller.failFor.has(body.to[0]))
      return {
        ok: false,
        status: controller.failStatus,
        headers: {
          get: (name) =>
            name.toLowerCase() === 'retry-after' ? controller.retryAfter : null,
        },
        json: async () => ({}),
      }
    if (!controller.messages.has(key))
      controller.messages.set(key, `msg-${controller.messages.size + 1}`)
    return {
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => ({ id: controller.messages.get(key) }),
    }
  }
  return controller
}
