create table if not exists public.waitlist_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  audience text not null check (audience in ('food_lover', 'cook')),
  updates_consent boolean not null default false,
  source text not null default 'website',
  created_at timestamptz not null default now()
);

create unique index if not exists waitlist_subscribers_email_lower_key
  on public.waitlist_subscribers (lower(email));

alter table public.waitlist_subscribers enable row level security;

revoke all on public.waitlist_subscribers from anon, authenticated;
grant insert (email, audience, updates_consent, source)
  on public.waitlist_subscribers to anon, authenticated;

drop policy if exists "Public can join waitlist" on public.waitlist_subscribers;
create policy "Public can join waitlist"
  on public.waitlist_subscribers
  for insert
  to anon, authenticated
  with check (
    email = lower(trim(email))
    and char_length(email) between 3 and 254
    and source = 'website'
  );