-- Referral reward update: credit the referrer NGN 1,000 after the invited member
-- confirms their email, and queue one transactional reward email in the same transaction.
-- Existing referrals keep their prior second-milestone eligibility. New referrals are
-- marked complete at signup so the legacy second-milestone triggers cannot pay twice.

begin;

do $$
begin
  if to_regclass('public.referrals') is null
     or to_regclass('public.wallet_transactions') is null
     or to_regclass('public.email_deliveries') is null then
    raise exception 'Referral wallet and email-delivery migrations must be applied first';
  end if;
  if to_regprocedure('public.food4love_apply_wallet_delta(uuid,integer,text,text)') is null then
    raise exception 'Wallet credit function is missing';
  end if;
end;
$$;

-- Track the feature launch so email reconciliation never sends notices for older referrals.
create table if not exists public.referral_reward_email_cutover (
  id boolean primary key default true check (id),
  applied_at timestamptz not null default now()
);
insert into public.referral_reward_email_cutover (id) values (true)
  on conflict (id) do nothing;
alter table public.referral_reward_email_cutover enable row level security;
revoke all on public.referral_reward_email_cutover from public, anon, authenticated;
grant all on public.referral_reward_email_cutover to service_role;

-- Preserve the existing email kinds while enabling the new transactional reward notice.
alter table public.email_deliveries
  drop constraint if exists email_deliveries_kind_check;
alter table public.email_deliveries
  add constraint email_deliveries_kind_check
  check (kind in (
    'waitlist_confirmation', 'welcome', 'interest_verified',
    'tester_invitation', 'password_recovery', 'referral_reward'
  ));

create or replace function public.food4love_reward_referral_signup()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  referral_code_input text;
  referrer uuid;
  referral_id uuid;
begin
  -- Signup rewards are issued only after the invitee proves control of their email.
  if new.email_confirmed_at is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.email_confirmed_at is not null then
    return new;
  end if;

  referral_code_input := upper(btrim(coalesce(new.raw_user_meta_data ->> 'referral_code', '')));
  if referral_code_input = '' then
    return new;
  end if;

  select id into referrer
  from public.profiles
  where referral_code = referral_code_input
    and id <> new.id
  limit 1;

  if referrer is null then
    return new;
  end if;

  -- The full signup reward settles the new referral. Existing rows remain eligible for
  -- their already-promised second milestone because this only runs for a new referral.
  insert into public.referrals(
    referrer_id, referred_user_id, referral_code, signup_rewarded_at, second_rewarded_at
  )
  values (referrer, new.id, referral_code_input, now(), now())
  on conflict (referred_user_id) do nothing
  returning id into referral_id;

  if referral_id is not null then
    perform public.food4love_apply_wallet_delta(
      referrer, 1000, 'referral_signup', 'referral-signup:' || new.id::text
    );

    -- Email delivery is best-effort at signup; the durable outbox worker reconciles a
    -- missing row and sends later. Never make account confirmation depend on Resend.
    begin
      insert into public.email_deliveries (kind, recipient_key, status)
      values ('referral_reward', referral_id::text, 'queued')
      on conflict (kind, recipient_key) do nothing;
    exception when others then
      raise warning 'Referral reward email queue failed for referral % (SQLSTATE %)',
        referral_id, sqlstate;
    end;
  end if;

  return new;
end;
$$;

revoke all on function public.food4love_reward_referral_signup() from public, anon, authenticated;

commit;
