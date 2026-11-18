-- FOOD4LOVE - READ-ONLY readiness check for the three pending migrations.
--
--   supabase-migration-booking-verification.sql
--   supabase-migration-interest-verification-email.sql
--   supabase-migration-tester-invitations.sql
--
-- HOW TO USE: Supabase dashboard > SQL Editor > New query. Paste PART A (or the whole file: Part B is
-- commented out, so it does nothing), run it, read the RESULT column. Then (optionally) run the PART B
-- statements ONE AT A TIME, removing the leading "-- " from the single block you want.
--
-- THIS FILE ONLY READS. It contains SELECT statements and nothing else: no insert, update,
-- delete, create, alter, drop, grant, dynamic SQL, or function with side effects (a repo test
-- enforces this with an allow-list of the few catalog functions it calls, for Part A AND Part B).
-- It reads the database's own catalog (what tables, columns, triggers and permissions exist) and,
-- in Part B, returns COUNTS only. It never selects an email address, a name, a token, a password,
-- or any customer/cook identifier: Part A returns object names; Part B returns numbers and states.
-- The one touch of the auth schema is a count in B7.
--
-- STATUS OF THIS FILE: executed against a throwaway in-memory PostgreSQL (PGlite) that imitates
-- Supabase's roles; NEVER executed against Supabase itself. There it ran without error (a) on a
-- database where none of the new objects exist, (b) on a fully migrated one, (c) pasted whole,
-- inside a READ ONLY transaction, changing nothing, and (d) it flagged nine deliberately broken
-- states. Supabase differs in ways PGlite cannot imitate, so if the editor reports an error,
-- nothing has run and nothing has changed: send the exact message back.
--
-- HOW TO READ PART A (one row per check; the `section` column groups them):
--   OK       the object/permission is as the migrations expect
--   MISSING  not there yet (a migration has not been applied, or was partly applied)
--   PROBLEM  there but NOT as expected: read the detail column before doing anything
--   INFO     context only
--
-- WHAT EACH SECTION CHECKS, AND WHAT YOU SHOULD SEE
--   tables       The 5 tables the features read, plus the 4 they create. Expect OK for every
--                existing table. A MISSING on booking_interests / booking_events /
--                tester_invitations means that migration is not applied yet.
--   columns      Specific columns (e.g. email_deliveries.next_attempt_at, profiles.kyc_status).
--                MISSING next_attempt_at = interest-verification-email not applied.
--   baseline     The EXISTING parts the new features stand on (signup trigger on auth.users, the profiles guard trigger,
--                row level security on profiles and notifications, notification kinds). On production these should already be OK.
--                On a brand-new staging project every row is MISSING until the application's baseline schema is built.
--   constraints  Whether the email_deliveries CHECKs already allow the new kinds/states, and
--                whether bookings allows 'alternative_proposed'. MISSING = migration not applied.
--   triggers     booking_guard, the verification trigger, booking_interest_guard,
--                tester_invitations_guard. The row "verification trigger function version" is the
--                important one: OK = the NEW version (queues the email); PROBLEM = the OLD
--                version is live, so verification sends NO email. That happens if
--                booking-verification was run AFTER interest-verification-email. Fix: run
--                interest-verification-email again.
--   indexes      The unique/lookup indexes that make duplicates impossible. MISSING = not applied.
--   row level security / permissions
--                RLS must be ON for the 4 new tables; email_deliveries and tester_invitations must
--                have NO policy and NO privilege for the browser roles (anon, authenticated);
--                booking_interests / booking_events must be readable (not writable) by signed-in
--                members and unreadable by anon. ANY PROBLEM HERE IS A SECURITY ISSUE: stop and
--                send the row back before applying anything.
--   functions    admin_lookup_auth_user must exist and must NOT be executable by the browser
--                roles; my_interest_count must exist.
--   context      The Postgres version. Informational.
--
-- EXPECTED RESULT BEFORE ANY OF THE THREE MIGRATIONS ARE APPLIED: OK for the existing tables
-- and email_deliveries; MISSING for everything new; NO PROBLEM rows. AFTER ALL ARE APPLIED:
-- every row OK (email_events may read MISSING if the admin-intelligence migration was not
-- applied; that is unrelated). Any PROBLEM row at any time deserves attention.

-- =====================================================================================
-- PART A - structure and permissions (safe to run even if every table is missing)
-- =====================================================================================
select section, check_name, result, detail
from (
  -- 1. tables the migrations need or create
  select 10 as ord, 'tables' as section, 'public.' || t as check_name,
         case when to_regclass('public.' || t) is not null then 'OK' else 'MISSING' end as result,
         case t
           when 'booking_interests'    then 'created by booking-verification'
           when 'booking_events'       then 'created by booking-verification'
           when 'tester_invitations'   then 'created by tester-invitations'
           when 'email_deliveries'     then 'created by email-deliveries (applied 2026-11-13 per handover)'
           when 'admin_audit_log'      then 'needed by invitations and admin actions'
           when 'interest_email_cutover' then 'created by interest-verification-email (when the outbox went live)'
           else 'existing table the migrations rely on'
         end as detail
    from (values ('profiles'), ('notifications'), ('matches'), ('cook_availability'),
                 ('bookings'), ('booking_events'), ('booking_interests'),
                 ('email_deliveries'), ('email_events'), ('admin_audit_log'),
                 ('tester_invitations'), ('interest_email_cutover')) as w(t)

  union all
  -- 2. columns
  select 20, 'columns', 'public.' || w.t || '.' || w.c,
         case when exists (select 1 from information_schema.columns k
                            where k.table_schema = 'public' and k.table_name = w.t and k.column_name = w.c)
              then 'OK' else 'MISSING' end,
         w.note
    from (values
      ('profiles',         'kyc_status',               'verification authority'),
      ('profiles',         'suspended',                'checked before emailing'),
      ('profiles',         'onboarding_complete',      'checked by the booking guard'),
      ('profiles',         'notification_preferences', 'booking-update opt-out is read from here'),
      ('notifications',    'data',                     'jsonb; carries event_key'),
      ('bookings',         'service_type',             'booking-verification'),
      ('bookings',         'proposed_scheduled_for',   'booking-verification'),
      ('email_deliveries', 'attempts',                 'email-deliveries'),
      ('email_deliveries', 'provider_message_id',      'email-deliveries'),
      ('email_deliveries', 'next_attempt_at',          'added by interest-verification-email'),
      ('booking_interests','notify_when_verified',     'booking-verification'),
      ('tester_invitations','token_hash',              'tester-invitations (hash only)'),
      ('tester_invitations','claimed_at',              'tester-invitations')
    ) as w(t, c, note)

  union all
  -- 2b. the EXISTING baseline the new features depend on. A brand-new Supabase project has NONE of this;
  --     on production it should all read OK already. Read-only: it asks the catalog what exists.
  select 15, 'baseline', 'a signup trigger on auth.users runs a public function (creates profiles)',
         case when to_regclass('auth.users') is null then 'MISSING'
              when exists (select 1 from pg_trigger g
                             join pg_proc p on p.oid = g.tgfoid
                             join pg_namespace n on n.oid = p.pronamespace
                            where g.tgrelid = to_regclass('auth.users') and not g.tgisinternal
                              and n.nspname = 'public')
              then 'OK' else 'MISSING' end,
         'new accounts need a profile row. The invitation flow creates one itself if the trigger did not, but sign-ups depend on it.'
  union all
  select 16, 'baseline', 'profiles guard trigger exists (members cannot verify themselves)',
         case when to_regclass('public.profiles') is null then 'MISSING'
              when exists (select 1 from pg_trigger g
                            where g.tgrelid = to_regclass('public.profiles') and not g.tgisinternal
                              and g.tgname = 'food4love_guard_profile_privileges')
              then 'OK' else 'MISSING' end,
         'without it a cook could mark themselves verified: do not test verification until it exists'
  union all
  select 17, 'baseline', 'public.' || w.t || ' has row level security on',
         case when to_regclass('public.' || w.t) is null then 'MISSING'
              when (select c.relrowsecurity from pg_class c where c.oid = to_regclass('public.' || w.t))
              then 'OK' else 'PROBLEM' end,
         'profiles and notifications must be protected before any test account is created'
    from (values ('profiles'), ('notifications')) as w(t)
  union all
  select 18, 'baseline', 'notifications.type accepts the kinds the features write (booking, system)',
         case when to_regclass('public.notifications') is null then 'MISSING'
              when not exists (select 1 from pg_constraint c
                                where c.conrelid = to_regclass('public.notifications')
                                  and c.contype = 'c' and pg_get_constraintdef(c.oid) like '%type%')
              then 'OK'
              when exists (select 1 from pg_constraint c
                            where c.conrelid = to_regclass('public.notifications')
                              and c.contype = 'c' and pg_get_constraintdef(c.oid) like '%type%'
                              and pg_get_constraintdef(c.oid) like '%booking%'
                              and pg_get_constraintdef(c.oid) like '%system%')
              then 'OK' else 'PROBLEM' end,
         'OK when there is no restriction, or the restriction lists both'

  union all
  -- 3. check constraints (is the NEW definition in place?)
  select 30, 'constraints', 'email_deliveries kind allows ' || w.v,
         case when to_regclass('public.email_deliveries') is null then 'MISSING'
              when exists (select 1 from pg_constraint c
                            where c.conrelid = to_regclass('public.email_deliveries')
                              and c.contype = 'c' and pg_get_constraintdef(c.oid) like '%' || w.v || '%')
              then 'OK' else 'MISSING' end,
         'needs interest-verification-email'
    from (values ('interest_verified'), ('tester_invitation'), ('password_recovery')) as w(v)
  union all
  select 31, 'constraints', 'email_deliveries status allows ' || w.v,
         case when to_regclass('public.email_deliveries') is null then 'MISSING'
              when exists (select 1 from pg_constraint c
                            where c.conrelid = to_regclass('public.email_deliveries')
                              and c.contype = 'c' and pg_get_constraintdef(c.oid) like '%' || w.v || '%')
              then 'OK' else 'MISSING' end,
         'needs interest-verification-email'
    from (values ('processing'), ('cancelled')) as w(v)
  union all
  select 32, 'constraints', 'bookings status allows alternative_proposed',
         case when to_regclass('public.bookings') is null then 'MISSING'
              when exists (select 1 from pg_constraint c
                            where c.conrelid = to_regclass('public.bookings')
                              and c.contype = 'c' and pg_get_constraintdef(c.oid) like '%alternative_proposed%')
              then 'OK' else 'MISSING' end,
         'needs booking-verification'

  union all
  -- 4. triggers and the CURRENT body of the verification trigger function
  select 40, 'triggers', w.trg || ' on ' || w.tbl,
         case when to_regclass('public.' || w.tbl) is null then 'MISSING'
              when exists (select 1 from pg_trigger g
                            where g.tgname = w.trg and g.tgrelid = to_regclass('public.' || w.tbl)
                              and not g.tgisinternal)
              then 'OK' else 'MISSING' end,
         w.note
    from (values
      ('booking_guard',                     'bookings',           'booking-verification'),
      ('zz_booking_interest_on_verification','profiles',          'booking-verification (fires when kyc_status changes)'),
      ('booking_interest_guard',            'booking_interests',  'booking-verification'),
      ('tester_invitations_guard',          'tester_invitations', 'tester-invitations (accepted/revoked are final)')
    ) as w(trg, tbl, note)
  union all
  select 41, 'triggers', 'verification trigger function version',
         case
           when not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                             where n.nspname = 'public' and p.proname = 'booking_interest_on_verification')
             then 'MISSING'
           when exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                         where n.nspname = 'public' and p.proname = 'booking_interest_on_verification'
                           and p.prosrc like '%interest_verified%')
             then 'OK'
           else 'PROBLEM'
         end,
         'OK = the NEW version (queues the email). PROBLEM = the OLD version is live: in-app notice only, no email is queued. Apply interest-verification-email.'

  union all
  -- 5. indexes
  select 50, 'indexes', w.idx,
         case when exists (select 1 from pg_indexes i where i.schemaname = 'public' and i.indexname = w.idx)
              then 'OK' else 'MISSING' end,
         w.note
    from (values
      ('booking_interests_one_active_idx',      'one active request per customer and cook'),
      ('notifications_event_key_once',          'one notification per event, ever'),
      ('bookings_one_active_per_slot_idx',      'no duplicate active bookings'),
      ('email_deliveries_due_idx',              'worker queue lookups'),
      ('tester_invitations_one_pending_per_email','one live invitation per address'),
      ('tester_invitations_username_in_use',    'usernames unique across live invitations')
    ) as w(idx, note)

  union all
  -- 6. row level security must be ON for every table the migrations create
  select 60, 'row level security', 'public.' || w.t || ' RLS enabled',
         case when to_regclass('public.' || w.t) is null then 'MISSING'
              when (select c.relrowsecurity from pg_class c where c.oid = to_regclass('public.' || w.t))
              then 'OK' else 'PROBLEM' end,
         'must be on'
    from (values ('booking_events'), ('booking_interests'), ('email_deliveries'), ('tester_invitations'), ('interest_email_cutover')) as w(t)
  union all
  -- server-only tables: no policy and no browser-role privilege of ANY kind
  select 61, 'row level security', 'public.' || w.t || ' has no policies',
         case when to_regclass('public.' || w.t) is null then 'MISSING'
              when (select count(*) from pg_policies p where p.schemaname = 'public' and p.tablename = w.t) = 0
              then 'OK' else 'PROBLEM' end,
         'server-only table: expect 0 policies'
    from (values ('email_deliveries'), ('tester_invitations'), ('interest_email_cutover')) as w(t)
  union all
  select 62, 'permissions', r.role_name || ' has NO privilege on public.' || t.tbl,
         case when to_regclass('public.' || t.tbl) is null then 'MISSING'
              when not has_table_privilege(r.role_name::name, to_regclass('public.' || t.tbl)::oid,
                                           'select,insert,update,delete,truncate,references,trigger')
              then 'OK' else 'PROBLEM' end,
         'server-only table: browser roles must have nothing'
    from (values ('email_deliveries'), ('tester_invitations'), ('interest_email_cutover')) as t(tbl)
    cross join (values ('anon'), ('authenticated')) as r(role_name)
  union all
  -- interest/event tables: the signed-in customer may READ (their own rows via RLS), never write
  select 63, 'permissions', r.role_name || ' cannot WRITE public.' || t.tbl,
         case when to_regclass('public.' || t.tbl) is null then 'MISSING'
              when not has_table_privilege(r.role_name::name, to_regclass('public.' || t.tbl)::oid,
                                           'insert,update,delete,truncate')
              then 'OK' else 'PROBLEM' end,
         'writes happen only through the server'
    from (values ('booking_interests'), ('booking_events')) as t(tbl)
    cross join (values ('anon'), ('authenticated')) as r(role_name)
  union all
  select 64, 'permissions', 'anon cannot read public.booking_interests',
         case when to_regclass('public.booking_interests') is null then 'MISSING'
              when not has_table_privilege('anon', to_regclass('public.booking_interests')::oid, 'select')
              then 'OK' else 'PROBLEM' end,
         'a customer''s interest requests are private'

  union all
  -- 7. functions
  select 70, 'functions', 'admin_lookup_auth_user exists',
         case when to_regprocedure('public.admin_lookup_auth_user(text)') is not null then 'OK' else 'MISSING' end,
         'tester-invitations (the code falls back to scanning users if absent)'
  union all
  select 71, 'functions', 'browser roles cannot run admin_lookup_auth_user',
         case when to_regprocedure('public.admin_lookup_auth_user(text)') is null then 'MISSING'
              when not has_function_privilege('anon', to_regprocedure('public.admin_lookup_auth_user(text)')::oid, 'execute')
               and not has_function_privilege('authenticated', to_regprocedure('public.admin_lookup_auth_user(text)')::oid, 'execute')
              then 'OK' else 'PROBLEM' end,
         'it reads auth.users, so only the server (service role) may call it'
  union all
  select 72, 'functions', 'my_interest_count exists',
         case when to_regprocedure('public.my_interest_count()') is not null then 'OK' else 'MISSING' end,
         'booking-verification'

  union all
  -- 8. context
  select 90, 'context', 'database version', 'INFO', version()
) as checks
order by ord, check_name;


-- =====================================================================================
-- PART B - row counts only (run each statement separately, ONLY if Part A shows its tables
-- as OK; the SQL Editor shows the result of the statement you have selected).
-- No personal data is selected: counts and statuses only.
-- =====================================================================================

-- B1. interest requests by state (needs booking_interests)
-- select status, notify_when_verified, count(*) as requests
--   from public.booking_interests group by 1, 2 order by 1, 2;

-- B2. should be 0: still-active requests for a cook who is ALREADY verified
-- select count(*) as stale_active_requests
--   from public.booking_interests i join public.profiles p on p.id = i.cook_id
--  where i.status = 'active' and p.kyc_status = 'verified';

-- B3. email queue by kind and state (needs email_deliveries)
-- select kind, status, count(*) as emails, max(attempts) as most_attempts
--   from public.email_deliveries group by 1, 2 order by 1, 2;

-- B4. customers who asked to be told and whose cook is now verified, but who have NO queued or
--     sent email. This counts BOTH kinds: people fulfilled before the outbox existed (historical:
--     never emailed automatically) and people the outbox missed (recovered automatically by the
--     scheduled reconciliation). B8 below separates them.
-- select count(*) as asked_and_never_emailed
--   from public.booking_interests i
--  where i.notify_when_verified and i.status = 'fulfilled'
--    and not exists (select 1 from public.email_deliveries d
--                     where d.kind = 'interest_verified' and d.recipient_key = i.id::text);

-- B5. booking-verification precondition: must be 0. COUNT ONLY: it deliberately does not list who the
--     duplicates are (that would show customer identifiers). If it is not 0, do not apply booking-verification;
--     the header of that migration has the row-level query to run in a private session.
-- select count(*) as duplicate_active_booking_groups
--   from (select 1
--           from public.bookings
--          where status in ('pending', 'alternative_proposed', 'confirmed')
--          group by buyer_id, cook_id, scheduled_for
--         having count(*) > 1) d;

-- B6. invitations by state (needs tester_invitations)
-- select status, access_type, count(*) as invitations
--   from public.tester_invitations group by 1, 2 order by 1, 2;

-- B7. invited-but-never-used accounts (context: these are what "revoke" cleans up)
-- select count(*) as invited_never_used
--   from auth.users u
--  where u.email_confirmed_at is null and u.last_sign_in_at is null
--    and u.invited_at is not null;

-- B8. B4 split in two (needs interest_email_cutover, so only after interest-verification-email):
--     "recoverable" = fulfilled AFTER the outbox went live and within the last 14 days: the server's
--     reconciliation queues these by itself (after re-checking consent, preferences and that the cook is
--     still verified). "historical" = fulfilled before the cutover or longer ago: NEVER emailed
--     automatically; the owner decides (see the handover). Counts only.
-- select
--   count(*) filter (where i.customer_notified_at >= c.applied_at and i.customer_notified_at > now() - interval '14 days') as recoverable,
--   count(*) filter (where i.customer_notified_at < c.applied_at) as historical_before_cutover,
--   count(*) filter (where i.customer_notified_at >= c.applied_at and i.customer_notified_at <= now() - interval '14 days') as too_old_to_recover
--   from public.booking_interests i cross join public.interest_email_cutover c
--  where i.notify_when_verified and i.status = 'fulfilled' and i.customer_notified_at is not null
--    and not exists (select 1 from public.email_deliveries d
--                     where d.kind = 'interest_verified' and d.recipient_key = i.id::text);
