-- Creates a profile when a new Supabase Auth user is registered.
-- Existing profiles are left unchanged; the trigger uses a unique Food4Love name.
create or replace function public.food4love_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(
      nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'New user'
    ),
    case
      when new.raw_user_meta_data ->> 'role' = 'cook' then 'cook'
      else 'buyer'
    end
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

-- Trigger functions are invoked by the trigger, not by an API caller.
-- Supabase may grant EXECUTE to anon/authenticated through default privileges,
-- so revoke those grants explicitly as well as PUBLIC.
revoke all on function public.food4love_handle_new_user()
  from public, anon, authenticated, service_role;

drop trigger if exists food4love_create_profile_after_signup on auth.users;
create trigger food4love_create_profile_after_signup
  after insert on auth.users
  for each row execute function public.food4love_handle_new_user();
