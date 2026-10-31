-- Chef Chi, the built-in AI chat every account gets.
-- Run in Supabase Dashboard -> SQL Editor. Safe to run more than once.
-- One private conversation per user. Users can read, add their own messages
-- and clear their chat. Chef Chi's replies are written by the server only, so
-- nobody can put words in the assistant's mouth.

create table if not exists ai_chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (char_length(content) between 1 and 4000),
  -- Which AI answered, for debugging and cost tracking ('gemini' or 'grok').
  provider text,
  created_at timestamptz not null default now()
);

create index if not exists ai_chat_messages_user_created_idx
  on ai_chat_messages (user_id, created_at desc);

alter table ai_chat_messages enable row level security;

drop policy if exists "Read own Chef Chi chat" on ai_chat_messages;
create policy "Read own Chef Chi chat" on ai_chat_messages
  for select using (auth.uid() = user_id);

drop policy if exists "Send own Chef Chi messages" on ai_chat_messages;
create policy "Send own Chef Chi messages" on ai_chat_messages
  for insert with check (auth.uid() = user_id and role = 'user');

drop policy if exists "Clear own Chef Chi chat" on ai_chat_messages;
create policy "Clear own Chef Chi chat" on ai_chat_messages
  for delete using (auth.uid() = user_id);
