-- Referral wallet for the agreed Food4Love rewards:
-- ₦500 to the referrer after signup, then ₦500 after the invitee's first
-- qualifying paid booking (buyer or cook) or, for cooks, KYC verification.
-- Signup is credited after email confirmation. All monetary mutations are
-- server/trigger only and idempotent.
begin;

alter table public.profiles
  add column if not exists referral_code text;

update public.profiles
set referral_code = upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12))
where referral_code is null;

alter table public.profiles
  alter column referral_code set default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)),
  alter column referral_code set not null;

create unique index if not exists profiles_referral_code_uidx
  on public.profiles (referral_code);

create table if not exists public.wallet_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  balance_naira integer not null default 0 check (balance_naira >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount_naira integer not null check (amount_naira <> 0),
  transaction_type text not null check (transaction_type in (
    'referral_signup', 'referral_second_milestone', 'paystack_topup', 'booking_payment'
  )),
  source_key text not null unique,
  created_at timestamptz not null default now()
);

create index if not exists wallet_transactions_user_created_idx
  on public.wallet_transactions (user_id, created_at desc);

create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references auth.users(id) on delete cascade,
  referred_user_id uuid not null unique references auth.users(id) on delete cascade,
  referral_code text not null,
  signup_rewarded_at timestamptz,
  second_rewarded_at timestamptz,
  second_reward_reason text check (second_reward_reason in ('paid_booking', 'cook_verified')),
  created_at timestamptz not null default now(),
  constraint referrals_no_self_referral check (referrer_id <> referred_user_id)
);

create index if not exists referrals_referrer_created_idx
  on public.referrals (referrer_id, created_at desc);

create table if not exists public.wallet_topups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount_naira integer not null check (amount_naira between 500 and 500000),
  paystack_reference text not null unique,
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed')),
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

alter table public.bookings
  add column if not exists wallet_credit_used integer not null default 0
  check (wallet_credit_used >= 0);

alter table public.wallet_accounts enable row level security;
alter table public.wallet_transactions enable row level security;
alter table public.referrals enable row level security;
alter table public.wallet_topups enable row level security;

revoke all on public.wallet_accounts, public.wallet_transactions, public.referrals, public.wallet_topups
  from anon, authenticated;
grant select on public.wallet_accounts, public.wallet_transactions, public.referrals, public.wallet_topups
  to authenticated;
grant all on public.wallet_accounts, public.wallet_transactions, public.referrals, public.wallet_topups
  to service_role;

drop policy if exists "Users read own wallet account" on public.wallet_accounts;
create policy "Users read own wallet account" on public.wallet_accounts
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "Users read own wallet transactions" on public.wallet_transactions;
create policy "Users read own wallet transactions" on public.wallet_transactions
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "Referral participants read their referral" on public.referrals;
create policy "Referral participants read their referral" on public.referrals
  for select to authenticated using (
    (select auth.uid()) = referrer_id or (select auth.uid()) = referred_user_id
  );

drop policy if exists "Users read own wallet topups" on public.wallet_topups;
create policy "Users read own wallet topups" on public.wallet_topups
  for select to authenticated using ((select auth.uid()) = user_id);

create or replace function public.food4love_apply_wallet_delta(
  p_user_id uuid,
  p_amount_naira integer,
  p_transaction_type text,
  p_source_key text
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  inserted_id uuid;
  resulting_balance integer;
begin
  if p_amount_naira = 0 or p_source_key is null or p_source_key = '' then
    raise exception 'Invalid wallet transaction';
  end if;
  if p_transaction_type not in (
    'referral_signup', 'referral_second_milestone', 'paystack_topup', 'booking_payment'
  ) then
    raise exception 'Invalid wallet transaction type';
  end if;
  if (p_transaction_type = 'booking_payment' and p_amount_naira >= 0)
    or (p_transaction_type <> 'booking_payment' and p_amount_naira <= 0) then
    raise exception 'Wallet transaction sign does not match its type';
  end if;

  insert into public.wallet_transactions(user_id, amount_naira, transaction_type, source_key)
  values (p_user_id, p_amount_naira, p_transaction_type, p_source_key)
  on conflict (source_key) do nothing
  returning id into inserted_id;

  if inserted_id is null then
    return false;
  end if;

  if p_amount_naira > 0 then
    insert into public.wallet_accounts(user_id, balance_naira, updated_at)
    values (p_user_id, p_amount_naira, now())
    on conflict (user_id) do update
      set balance_naira = public.wallet_accounts.balance_naira + excluded.balance_naira,
          updated_at = now()
    returning balance_naira into resulting_balance;
  else
    update public.wallet_accounts
    set balance_naira = balance_naira + p_amount_naira,
        updated_at = now()
    where user_id = p_user_id
      and balance_naira + p_amount_naira >= 0
    returning balance_naira into resulting_balance;
    if not found then
      raise exception 'Insufficient wallet balance';
    end if;
  end if;

  return true;
end;
$$;

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

  insert into public.referrals(referrer_id, referred_user_id, referral_code, signup_rewarded_at)
  values (referrer, new.id, referral_code_input, now())
  on conflict (referred_user_id) do nothing
  returning id into referral_id;

  if referral_id is not null then
    perform public.food4love_apply_wallet_delta(
      referrer, 500, 'referral_signup', 'referral-signup:' || new.id::text
    );
  end if;

  return new;
end;
$$;

create or replace function public.food4love_reward_cook_verification()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  referral record;
begin
  if new.role <> 'cook' or new.kyc_status <> 'verified'
    or old.kyc_status is not distinct from 'verified' then
    return new;
  end if;

  update public.referrals
  set second_rewarded_at = now(), second_reward_reason = 'cook_verified'
  where referred_user_id = new.id and second_rewarded_at is null
  returning id, referrer_id into referral;

  if referral.id is not null then
    perform public.food4love_apply_wallet_delta(
      referral.referrer_id, 500, 'referral_second_milestone',
      'referral-second:' || referral.id::text
    );
  end if;
  return new;
end;
$$;

create or replace function public.food4love_reward_first_paid_booking()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  invitee_id uuid;
  referral_id uuid;
  referrer_id uuid;
begin
  if new.payment_status <> 'paid' or old.payment_status is not distinct from 'paid' then
    return new;
  end if;

  foreach invitee_id in array array[new.buyer_id, new.cook_id] loop
    if invitee_id is null then
      continue;
    end if;

    referral_id := null;
    referrer_id := null;
    update public.referrals r
    set second_rewarded_at = now(), second_reward_reason = 'paid_booking'
    from public.profiles p
    where r.referred_user_id = invitee_id
      and r.referred_user_id = p.id
      and r.second_rewarded_at is null
      and ((p.role = 'buyer' and new.buyer_id = invitee_id)
        or (p.role = 'cook' and new.cook_id = invitee_id))
    returning r.id, r.referrer_id into referral_id, referrer_id;

    if referral_id is not null then
      perform public.food4love_apply_wallet_delta(
        referrer_id, 500, 'referral_second_milestone',
        'referral-second:' || referral_id::text
      );
    end if;
  end loop;
  return new;
end;
$$;

create or replace function public.food4love_complete_wallet_topup(p_reference text)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  topup public.wallet_topups%rowtype;
begin
  select * into topup
  from public.wallet_topups
  where paystack_reference = p_reference
  for update;

  if not found then
    raise exception 'Wallet top-up not found';
  end if;
  if topup.status = 'paid' then
    return false;
  end if;
  if topup.status <> 'pending' then
    raise exception 'Wallet top-up is not awaiting payment';
  end if;

  update public.wallet_topups set status = 'paid', paid_at = now() where id = topup.id;
  perform public.food4love_apply_wallet_delta(
    topup.user_id, topup.amount_naira, 'paystack_topup', 'wallet-topup:' || topup.paystack_reference
  );
  return true;
end;
$$;

create or replace function public.food4love_pay_booking_with_wallet(
  p_booking_id uuid,
  p_buyer_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  booking public.bookings%rowtype;
  total integer;
begin
  select * into booking from public.bookings where id = p_booking_id for update;
  if not found or booking.buyer_id <> p_buyer_id then
    raise exception 'Booking not found';
  end if;
  if booking.status <> 'confirmed' or booking.payment_status not in ('unpaid', 'pending') then
    raise exception 'Booking is not eligible for wallet payment';
  end if;
  if booking.payment_reference is not null then
    raise exception 'A Paystack payment is already in progress for this booking';
  end if;

  total := coalesce(booking.amount, booking.price);
  if total <= 0 then
    raise exception 'Booking amount is invalid';
  end if;

  perform public.food4love_apply_wallet_delta(
    p_buyer_id, -total, 'booking_payment', 'booking-payment:' || booking.id::text
  );
  update public.bookings
  set payment_status = 'paid', wallet_credit_used = total, updated_at = now()
  where id = booking.id;
  return true;
end;
$$;

create or replace function public.food4love_mark_wallet_topup_failed(p_reference text)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.wallet_topups
  set status = 'failed'
  where paystack_reference = p_reference and status = 'pending';
  return found;
end;
$$;

drop trigger if exists zz_food4love_reward_referral_signup on auth.users;
drop trigger if exists zz_food4love_reward_referral_signup_insert on auth.users;
create trigger zz_food4love_reward_referral_signup_insert
  after insert on auth.users
  for each row execute function public.food4love_reward_referral_signup();
drop trigger if exists zz_food4love_reward_referral_signup_confirmed on auth.users;
create trigger zz_food4love_reward_referral_signup_confirmed
  after update of email_confirmed_at on auth.users
  for each row execute function public.food4love_reward_referral_signup();

drop trigger if exists food4love_reward_cook_verification on public.profiles;
create trigger food4love_reward_cook_verification
  after update of kyc_status on public.profiles
  for each row execute function public.food4love_reward_cook_verification();

drop trigger if exists food4love_reward_first_paid_booking on public.bookings;
create trigger food4love_reward_first_paid_booking
  after update of payment_status on public.bookings
  for each row execute function public.food4love_reward_first_paid_booking();

revoke all on function public.food4love_apply_wallet_delta(uuid, integer, text, text)
  from public, anon, authenticated;
revoke all on function public.food4love_reward_referral_signup()
  from public, anon, authenticated;
revoke all on function public.food4love_reward_cook_verification()
  from public, anon, authenticated;
revoke all on function public.food4love_reward_first_paid_booking()
  from public, anon, authenticated;
revoke all on function public.food4love_complete_wallet_topup(text)
  from public, anon, authenticated;
revoke all on function public.food4love_pay_booking_with_wallet(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.food4love_mark_wallet_topup_failed(text)
  from public, anon, authenticated;

grant execute on function public.food4love_complete_wallet_topup(text) to service_role;
grant execute on function public.food4love_pay_booking_with_wallet(uuid, uuid) to service_role;
grant execute on function public.food4love_mark_wallet_topup_failed(text) to service_role;

commit;
