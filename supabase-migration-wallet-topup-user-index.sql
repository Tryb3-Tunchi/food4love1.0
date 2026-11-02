create index if not exists wallet_topups_user_created_idx
  on public.wallet_topups (user_id, created_at desc);
