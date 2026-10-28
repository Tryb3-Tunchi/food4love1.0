-- Apply to staging only after reviewing the deployed booking/payment schema.
alter table public.bookings
  add column if not exists payment_status text not null default 'unpaid',
  add column if not exists updated_at timestamptz not null default now();

create table if not exists public.payment_refunds (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id),
  requested_by uuid not null references auth.users(id),
  amount_kobo bigint not null check (amount_kobo > 0),
  paid_amount_kobo bigint not null check (paid_amount_kobo > 0),
  reason text not null,
  provider text not null default 'paystack',
  provider_reference text not null,
  provider_refund_id text,
  status text not null check (status in ('requested', 'pending', 'processed', 'failed', 'cancelled')),
  provider_response jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists payment_refunds_one_inflight_per_booking
  on public.payment_refunds (booking_id)
  where status in ('requested', 'pending');
create index if not exists payment_refunds_booking_created_idx
  on public.payment_refunds (booking_id, created_at desc);

alter table public.payment_refunds enable row level security;
revoke all on public.payment_refunds from anon, authenticated;
grant select, insert, update on public.payment_refunds to service_role;

create or replace function public.food4love_mark_refund_processed(
  p_refund_id uuid,
  p_provider_refund_id text
)
returns table (refund_id uuid, booking_id uuid, booking_fully_refunded boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_refund public.payment_refunds%rowtype;
  v_total_processed bigint;
  v_booking_amount bigint;
begin
  select * into v_refund
  from public.payment_refunds
  where id = p_refund_id
  for update;

  if not found or v_refund.status not in ('requested', 'pending') then
    raise exception 'Refund is not awaiting reconciliation';
  end if;
  if v_refund.provider_refund_id is null
    or v_refund.provider_refund_id <> p_provider_refund_id then
    raise exception 'Provider refund ID does not match';
  end if;

  update public.payment_refunds
  set status = 'processed', updated_at = now()
  where id = p_refund_id;

  select coalesce(sum(amount_kobo), 0) into v_total_processed
  from public.payment_refunds
  where booking_id = v_refund.booking_id and status = 'processed';

  select paid_amount_kobo into v_booking_amount
  from public.payment_refunds
  where id = p_refund_id;

  perform 1 from public.bookings where id = v_refund.booking_id for update;
  if not found then raise exception 'Booking not found'; end if;

  if v_total_processed >= v_booking_amount then
    update public.bookings
    set payment_status = 'refunded', updated_at = now()
    where id = v_refund.booking_id;
  end if;

  return query select p_refund_id, v_refund.booking_id, v_total_processed >= v_booking_amount;
end;
$$;

revoke all on function public.food4love_mark_refund_processed(uuid, text) from public, anon, authenticated;
grant execute on function public.food4love_mark_refund_processed(uuid, text) to service_role;