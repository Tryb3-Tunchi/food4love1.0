create or replace function public.food4love_keep_referral_code_immutable()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.referral_code is distinct from old.referral_code then
    raise exception 'Referral codes cannot be changed';
  end if;
  return new;
end;
$$;

revoke all on function public.food4love_keep_referral_code_immutable()
  from public, anon, authenticated;

drop trigger if exists food4love_keep_referral_code_immutable on public.profiles;
create trigger food4love_keep_referral_code_immutable
  before update of referral_code on public.profiles
  for each row execute function public.food4love_keep_referral_code_immutable();
