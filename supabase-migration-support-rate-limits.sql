-- Persistent public support message rate limit (hashed caller identity only).
begin;

create table if not exists public.support_rate_limits (
  bucket_hash text primary key check (char_length(bucket_hash) = 64),
  window_started_at timestamptz not null,
  hit_count integer not null check (hit_count >= 0),
  updated_at timestamptz not null default now()
);

alter table public.support_rate_limits enable row level security;
revoke all on public.support_rate_limits from public, anon, authenticated;
grant all on public.support_rate_limits to service_role;

create or replace function public.food4love_allow_support_message(
  p_bucket_hash text,
  p_limit integer default 8,
  p_window_seconds integer default 600
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_hits integer;
begin
  if p_bucket_hash is null or p_bucket_hash !~ '^[0-9a-f]{64}$'
     or p_limit < 1 or p_limit > 100
     or p_window_seconds < 60 or p_window_seconds > 86400 then
    return false;
  end if;

  insert into public.support_rate_limits(bucket_hash, window_started_at, hit_count)
  values (p_bucket_hash, now(), 1)
  on conflict (bucket_hash) do update
    set window_started_at = case
          when public.support_rate_limits.window_started_at <= now() - make_interval(secs => p_window_seconds)
            then now()
          else public.support_rate_limits.window_started_at
        end,
        hit_count = case
          when public.support_rate_limits.window_started_at <= now() - make_interval(secs => p_window_seconds)
            then 1
          else public.support_rate_limits.hit_count + 1
        end,
        updated_at = now()
  returning hit_count into current_hits;

  if random() < 0.01 then
    delete from public.support_rate_limits
    where updated_at < now() - interval '1 day'
      and bucket_hash in (
        select bucket_hash from public.support_rate_limits
        where updated_at < now() - interval '1 day'
        limit 500
      );
  end if;
  return current_hits <= p_limit;
end;
$$;

revoke all on function public.food4love_allow_support_message(text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.food4love_allow_support_message(text, integer, integer)
  to service_role;

commit;
