-- FOOD4LOVE - READ-ONLY readiness check for the three pending migrations.
--
--   supabase-migration-booking-verification.sql
--   supabase-migration-interest-verification-email.sql
--   supabase-migration-tester-invitations.sql
--
-- HOW TO USE: Supabase dashboard > SQL Editor > New query. Paste PART A, run it, read the
-- RESULT column. Then (optionally) run the PART B statements ONE AT A TIME.
--
-- THIS FILE ONLY READS. It contains SELECT statements and nothing else: no insert, update,
-- delete, create, alter, drop, grant or function that writes. It reads the database's own
-- catalog (what tables, columns, triggers and permissions exist) and, in Part B, counts rows.
-- It never selects an email address, a name, a token, a password or any user content.
--
-- STATUS OF THIS FILE: written carefully but NOT EXECUTED by its author (no Postgres was
-- available where it was written). If the editor reports a syntax error, nothing has run and
-- nothing has changed; tell whoever is helping you the exact message.
--
-- HOW TO READ PART A:
--   OK       the object/permission is as the migrations expect
--   MISSING  not there yet (a migration has not been applied, or was partly applied)
--   PROBLEM  there but NOT as expected: read the detail column before doing anything
--   INFO     context only

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
           else 'existing table the migrations rely on'
         end as detail
    from (values ('profiles'), ('notifications'), ('matches'), ('cook_availability'),
                 ('bookings'), ('booking_events'), ('booking_interests'),
                 ('email_deliveries'), ('email_events'), ('admin_audit_log'),
                 ('tester_invitations')) as w(t)

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
  -- 3. check constraints (is the NEW definition in place?)
  select 30, 'constraints', 'email_deliveries kind allows ' || w.v,
         case when to_regclass('public.email_deliveries') is null then 'MISSING'
              when exists (select 1 from pg_constraint c
                            where c.conrelid = to_regclass('public.email_deliveries')
                              and c.contype = 'c' and pg_get_constraintdef(c.oid) like '%' || w.v || '%')
              then 'OK' else 'MISSING' end,
         'needs interest-verification-email'
    from (values ('interest_verified'), ('tester_invitation')) as w(v)
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
    from (values ('booking_events'), ('booking_interests'), ('email_deliveries'), ('tester_invitations')) as w(t)
  union all
  -- server-only tables: no policy and no browser-role privilege of ANY kind
  select 61, 'row level security', 'public.' || w.t || ' has no policies',
         case when to_regclass('public.' || w.t) is null then 'MISSING'
              when (select count(*) from pg_policies p where p.schemaname = 'public' and p.tablename = w.t) = 0
              then 'OK' else 'PROBLEM' end,
         'server-only table: expect 0 policies'
    from (values ('email_deliveries'), ('tester_invitations')) as w(t)
  union all
  select 62, 'permissions', r.role_name || ' has NO privilege on public.' || t.tbl,
         case when to_regclass('public.' || t.tbl) is null then 'MISSING'
              when not has_table_privilege(r.role_name::name, to_regclass('public.' || t.tbl)::oid,
                                           'select,insert,update,delete,truncate,references,trigger')
              then 'OK' else 'PROBLEM' end,
         'server-only table: browser roles must have nothing'
    from (values ('email_deliveries'), ('tester_invitations')) as t(tbl)
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
--     sent email. After applying interest-verification-email this should only list people
--     whose cook was verified BEFORE that migration (they got the in-app notice only).
-- select count(*) as asked_and_never_emailed
--   from public.booking_interests i
--  where i.notify_when_verified and i.status = 'fulfilled'
--    and not exists (select 1 from public.email_deliveries d
--                     where d.kind = 'interest_verified' and d.recipient_key = i.id::text);

-- B5. booking-verification precondition: must return NO rows
-- select buyer_id, cook_id, scheduled_for, count(*) as copies
--   from public.bookings
--  where status in ('pending', 'alternative_proposed', 'confirmed')
--  group by 1, 2, 3 having count(*) > 1;

-- B6. invitations by state (needs tester_invitations)
-- select status, access_type, count(*) as invitations
--   from public.tester_invitations group by 1, 2 order by 1, 2;

-- B7. invited-but-never-used accounts (context: these are what "revoke" cleans up)
-- select count(*) as invited_never_used
--   from auth.users u
--  where u.email_confirmed_at is null and u.last_sign_in_at is null
--    and u.invited_at is not null;
