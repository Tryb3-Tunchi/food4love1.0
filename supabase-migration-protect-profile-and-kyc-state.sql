-- Review and apply in staging only after confirming the live schema and auth helpers.
-- Service-role API routes remain able to perform privileged state transitions.

create or replace function public.food4love_guard_profile_privileges()
returns trigger
language plpgsql
set search_path = public, auth
as $$
begin
  if auth.uid() = old.id and coalesce(auth.role(), '') <> 'service_role' then
    if new.kyc_status is distinct from old.kyc_status
      or new.is_verified is distinct from old.is_verified
      or new.suspended is distinct from old.suspended then
      raise exception 'Verification and suspension fields are server-managed';
    end if;

    if old.onboarding_complete and new.role is distinct from old.role then
      raise exception 'Role cannot be changed after onboarding is complete';
    end if;

    if old.onboarding_complete and not new.onboarding_complete then
      raise exception 'Completed onboarding cannot be reopened by the account owner';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists food4love_guard_profile_privileges on public.profiles;
create trigger food4love_guard_profile_privileges
  before update on public.profiles
  for each row execute function public.food4love_guard_profile_privileges();

create or replace function public.food4love_guard_kyc_review_fields()
returns trigger
language plpgsql
set search_path = public, auth
as $$
begin
  if coalesce(auth.role(), '') = 'service_role' or auth.uid() is null then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.user_id is distinct from auth.uid()
      or new.status is distinct from 'pending'
      or new.reviewed_at is not null
      or new.reviewed_by is not null
      or new.rejection_reason is not null then
      raise exception 'KYC review fields are server-managed';
    end if;
    return new;
  end if;

  if old.user_id = auth.uid() and (
    new.user_id is distinct from old.user_id
    or new.status is distinct from old.status
    or new.reviewed_at is distinct from old.reviewed_at
    or new.reviewed_by is distinct from old.reviewed_by
    or new.rejection_reason is distinct from old.rejection_reason
  ) then
    raise exception 'KYC review fields are server-managed';
  end if;

  return new;
end;
$$;

drop trigger if exists food4love_guard_kyc_review_fields on public.kyc_submissions;
create trigger food4love_guard_kyc_review_fields
  before insert or update on public.kyc_submissions
  for each row execute function public.food4love_guard_kyc_review_fields();

revoke all on function public.food4love_guard_profile_privileges() from public;
revoke all on function public.food4love_guard_kyc_review_fields() from public;