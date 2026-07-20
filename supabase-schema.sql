-- ============================================
-- FOOD4LOVE DATABASE SCHEMA
-- Run this in your Supabase SQL editor
-- ============================================

-- Profiles
create table profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text not null,
  avatar_url text,
  role text check (role in ('cook','buyer')) default 'buyer',
  bio text,
  location text,
  cuisines text[],
  photos text[],
  price_min integer,
  price_max integer,
  rating numeric(3,2),
  review_count integer default 0,
  is_verified boolean default false,
  kyc_status text check (kyc_status in ('unverified','pending','verified','rejected')) default 'unverified',
  streak integer default 0,
  tour_completed boolean default false,
  onboarding_complete boolean default false,
  suspended boolean default false,
  created_at timestamptz default now()
);

-- Daily specials
create table daily_specials (
  id uuid default gen_random_uuid() primary key,
  cook_id uuid references profiles(id) on delete cascade,
  title text not null,
  description text,
  price integer not null,
  image_url text,
  available_until timestamptz not null,
  created_at timestamptz default now()
);

-- Stories
create table stories (
  id uuid default gen_random_uuid() primary key,
  cook_id uuid references profiles(id) on delete cascade,
  image_url text not null,
  caption text,
  expires_at timestamptz default (now() + interval '24 hours'),
  created_at timestamptz default now()
);

-- Swipes
create table swipes (
  id uuid default gen_random_uuid() primary key,
  swiper_id uuid references profiles(id) on delete cascade,
  swiped_id uuid references profiles(id) on delete cascade,
  action text check (action in ('like','pass','superlike')) not null,
  created_at timestamptz default now(),
  unique(swiper_id, swiped_id)
);

-- Matches
create table matches (
  id uuid default gen_random_uuid() primary key,
  user1_id uuid references profiles(id) on delete cascade,
  user2_id uuid references profiles(id) on delete cascade,
  status text check (status in ('pending','matched','expired','blocked')) default 'matched',
  expires_at timestamptz not null,
  created_at timestamptz default now()
);

-- Messages
create table messages (
  id uuid default gen_random_uuid() primary key,
  match_id uuid references matches(id) on delete cascade,
  sender_id uuid references profiles(id) on delete cascade,
  content text not null,
  read_at timestamptz,
  created_at timestamptz default now()
);

-- Bookings
create table bookings (
  id uuid default gen_random_uuid() primary key,
  match_id uuid references matches(id),
  cook_id uuid references profiles(id),
  buyer_id uuid references profiles(id),
  dish_title text not null,
  price integer not null,
  status text check (status in ('pending','confirmed','completed','cancelled')) default 'pending',
  scheduled_for timestamptz,
  created_at timestamptz default now()
);

-- KYC submissions
create table kyc_submissions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade,
  full_name text not null,
  id_type text check (id_type in ('nin','bvn','passport','drivers_license')) not null,
  id_number text not null,
  id_document_url text not null,
  face_video_url text not null,
  selfie_url text,
  status text check (status in ('pending','approved','rejected')) default 'pending',
  rejection_reason text,
  submitted_at timestamptz default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references profiles(id)
);

-- Disputes
create table disputes (
  id uuid default gen_random_uuid() primary key,
  booking_id uuid references bookings(id),
  raised_by uuid references profiles(id),
  against uuid references profiles(id),
  reason text not null,
  description text not null,
  evidence_urls text[],
  status text check (status in ('open','ai_reviewed','admin_review','resolved_buyer','resolved_chef','resolved_partial')) default 'open',
  ai_recommendation text,
  ai_reasoning text,
  ai_confidence numeric(4,3),
  admin_notes text,
  resolution text,
  refund_amount integer,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Reviews
create table reviews (
  id uuid default gen_random_uuid() primary key,
  booking_id uuid references bookings(id),
  reviewer_id uuid references profiles(id),
  reviewee_id uuid references profiles(id),
  rating integer check (rating between 1 and 5) not null,
  comment text,
  created_at timestamptz default now()
);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
alter table profiles enable row level security;
alter table swipes enable row level security;
alter table matches enable row level security;
alter table messages enable row level security;
alter table bookings enable row level security;
alter table kyc_submissions enable row level security;
alter table disputes enable row level security;

-- Profiles: public read, own write
create policy "Public profiles visible" on profiles for select using (true);
create policy "Own profile editable" on profiles for update using (auth.uid() = id);

-- Swipes: own only
create policy "Own swipes" on swipes for all using (auth.uid() = swiper_id);

-- Matches: participants only
create policy "Match participants" on matches for select using (auth.uid() = user1_id or auth.uid() = user2_id);

-- Messages: match participants only
create policy "Message participants" on messages for select using (
  exists (select 1 from matches where id = match_id and (user1_id = auth.uid() or user2_id = auth.uid()))
);
create policy "Send messages" on messages for insert with check (auth.uid() = sender_id);

-- Bookings: participants only
create policy "Booking participants" on bookings for select using (auth.uid() = cook_id or auth.uid() = buyer_id);

-- KYC: own only
create policy "Own KYC" on kyc_submissions for all using (auth.uid() = user_id);

-- Realtime
alter publication supabase_realtime add table messages;
alter publication supabase_realtime add table matches;

-- Storage buckets (create these in Supabase dashboard too)
-- profile-photos: public
-- kyc-documents: private (service role only for admin reads)
