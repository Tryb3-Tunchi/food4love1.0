-- Admin tester invitations (Admin Intelligence Center → User management → Invite testers).
--
-- WHAT THIS ADDS (additive; creates one table, two functions; touches no existing data):
--   tester_invitations      one row per invitation. SERVER-ONLY: row level security is on
--                           with no policy and every browser role is revoked, so only the
--                           admin routes (service role) can read or write it.
--   admin_lookup_auth_user  lets the server ask "does an auth account exist for this email,
--                           and was it ever used?" without scanning every user. Service
--                           role only; it never returns an email, a name or a password.
--
-- WHY THE TOKEN IS NOT STORED: the invitation link carries a random secret. Only its
-- SHA-256 hash is saved (token_hash), so a database leak cannot be turned into working
-- invitation links. Resending issues a new secret and the old link stops working.
--
-- WHAT A TESTER TYPE IS NOT: access_type describes how someone takes part in testing. It
-- is never an admin role, never verification and never booking eligibility. It is kept
-- here and in the member's server-only auth app_metadata, NOT on `profiles` (which is
-- publicly readable).
--
-- ORDER: independent of the other new migration, but run
-- supabase-migration-interest-verification-email.sql first if you can. It adds the
-- 'tester_invitation' email kind to email_deliveries; without it invitation emails are still
-- sent, but their delivery state is not tracked (the admin table shows no delivery detail).
--
-- SAFE TO RE-RUN. NOT APPLIED to any database by this commit; the owner of the Supabase
-- project runs it. ROLLBACK:
--   drop function if exists public.admin_lookup_auth_user(text);
--   drop table if exists public.tester_invitations;

begin;

create table if not exists public.tester_invitations (
  id uuid primary key default gen_random_uuid(),
  email text not null check (email = lower(email) and length(email) <= 254),
  full_name text not null check (length(full_name) between 2 and 100),
  -- A short handle chosen by the admin. Food4Love has no username on profiles today, so
  -- this is kept with the invitation only (for the admin table and future use).
  preferred_username text check (preferred_username is null or preferred_username = lower(preferred_username)),
  access_type text not null
    check (access_type in ('beta_tester', 'regular_user', 'cook_tester', 'chef_tester')),
  -- the profiles.role the new account will get; must agree with access_type
  profile_role text not null check (profile_role in ('buyer', 'cook')),
  personal_message text check (personal_message is null or length(personal_message) <= 500),
  token_hash text not null unique,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'expired', 'revoked', 'failed')),
  -- short machine code such as 'email_not_sent' or 'auth:email_exists'. Never a token.
  failure_reason text,
  auth_user_id uuid references auth.users (id) on delete set null,
  invited_by uuid references auth.users (id) on delete set null,
  send_count integer not null default 0,
  last_sent_at timestamptz,
  expires_at timestamptz not null,
  -- set while someone is completing the invitation, so two submissions cannot both win
  claimed_at timestamptz,
  accepted_at timestamptz,
  revoked_at timestamptz,
  revoked_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tester_invitations_role_matches_access check (
    (access_type in ('beta_tester', 'regular_user') and profile_role = 'buyer')
    or (access_type in ('cook_tester', 'chef_tester') and profile_role = 'cook')
  )
);

-- One live invitation per address, enforced by the database (the admin screen can race).
create unique index if not exists tester_invitations_one_pending_per_email
  on public.tester_invitations (email) where status = 'pending';
create unique index if not exists tester_invitations_username_in_use
  on public.tester_invitations (preferred_username)
  where preferred_username is not null and status in ('pending', 'accepted');
create index if not exists tester_invitations_status_created_idx
  on public.tester_invitations (status, created_at desc);
create index if not exists tester_invitations_email_idx
  on public.tester_invitations (email, created_at desc);

-- Accepted and revoked are final. Nothing can quietly bring a revoked invitation back.
create or replace function public.tester_invitations_guard()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if old.status in ('accepted', 'revoked') and new.status is distinct from old.status then
    raise exception 'A % invitation can not change status', old.status using errcode = '23514';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists tester_invitations_guard on public.tester_invitations;
create trigger tester_invitations_guard
  before update on public.tester_invitations
  for each row execute function public.tester_invitations_guard();

alter table public.tester_invitations enable row level security;
revoke all on public.tester_invitations from anon, authenticated;
grant all on public.tester_invitations to service_role;
-- no policies on purpose: with row level security on and no policy, the browser roles
-- have no access even if a grant were added by mistake later.

-- Has this email got an auth account, and was it ever used?
create or replace function public.admin_lookup_auth_user(p_email text)
returns table (id uuid, confirmed boolean, signed_in_before boolean, has_profile boolean)
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select u.id,
         (u.email_confirmed_at is not null) as confirmed,
         (u.last_sign_in_at is not null) as signed_in_before,
         exists (select 1 from public.profiles p where p.id = u.id) as has_profile
    from auth.users u
   where lower(u.email) = lower(p_email)
   limit 1
$$;

revoke all on function public.admin_lookup_auth_user(text) from public, anon, authenticated;
grant execute on function public.admin_lookup_auth_user(text) to service_role;

commit;

-- READ-ONLY CHECKS to run AFTER applying -------------------------------------------
--   select relrowsecurity from pg_class where oid = 'public.tester_invitations'::regclass;   -- t
--   select count(*) from pg_policies where tablename = 'tester_invitations';                  -- 0
--   select has_table_privilege('authenticated', 'public.tester_invitations', 'select');       -- f
--   select has_function_privilege('authenticated', 'public.admin_lookup_auth_user(text)', 'execute'); -- f
--   select indexname from pg_indexes where tablename = 'tester_invitations';
