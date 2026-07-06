// // -- ============================================
// // -- FOOD4LOVE SEED DATA
// // -- Run in Supabase SQL Editor
// // -- Creates realistic chef profiles to test with
// // -- ============================================

// // -- First create auth users (do this via Supabase Dashboard > Authentication > Users)
// // -- Then run this after getting their UUIDs

// // -- Or use this approach: insert directly into profiles
// // -- (Assumes you've already created auth users with emails below)

// // -- DEMO CHEF 1
// INSERT INTO profiles (id, full_name, role, bio, location, cuisines, price_min, price_max, rating, review_count, is_verified, kyc_status, onboarding_complete, streak, avatar_url)
// SELECT 
//   id,
//   'Adaeze Okonkwo',
//   'cook',
//   'Self-taught Igbo cuisine specialist from Enugu. I learned to cook from my grandmother and I have been perfecting her recipes for 12 years. My Ofe Akwu is legendary in Lekki.',
//   'Lekki Phase 1, Lagos',
//   ARRAY['Igbo Cuisine', 'Nigerian Soups', 'Swallow & Soup'],
//   7500,
//   25000,
//   4.9,
//   47,
//   true,
//   'verified',
//   true,
//   12,
//   null
// FROM auth.users WHERE email = 'adaeze@food4love.demo'
// ON CONFLICT (id) DO UPDATE SET
//   full_name = EXCLUDED.full_name,
//   role = EXCLUDED.role,
//   bio = EXCLUDED.bio;

// -- DEMO CHEF 2
// INSERT INTO profiles (id, full_name, role, bio, location, cuisines, price_min, price_max, rating, review_count, is_verified, kyc_status, onboarding_complete, streak, avatar_url)
// SELECT 
//   id,
//   'Emeka Tochukwu',
//   'cook',
//   'The Jollof King of Surulere. Party Jollof is my religion. Trained under a professional caterer for 5 years before going solo. My small chops have made grown men cry.',
//   'Surulere, Lagos',
//   ARRAY['Jollof & Rice', 'Nigerian BBQ', 'Small Chops', 'Party Food'],
//   12000,
//   50000,
//   5.0,
//   63,
//   true,
//   'verified',
//   true,
//   8,
//   null
// FROM auth.users WHERE email = 'emeka@food4love.demo'
// ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name;

// -- DEMO CHEF 3
// INSERT INTO profiles (id, full_name, role, bio, location, cuisines, price_min, price_max, rating, review_count, is_verified, kyc_status, onboarding_complete, streak)
// SELECT 
//   id,
//   'Fatima Balogun',
//   'cook',
//   'Northern Nigerian cuisine with heart. My Tuwo Shinkafa and Miyan Kuka will take you straight to Kano. I also make the best Suya marinade you will ever taste.',
//   'Ikeja, Lagos',
//   ARRAY['Hausa Cuisine', 'Northern Nigerian', 'Suya & Grills'],
//   6500,
//   18000,
//   4.9,
//   31,
//   true,
//   'verified',
//   true,
//   5
// FROM auth.users WHERE email = 'fatima@food4love.demo'
// ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name;

// -- DEMO BUYER
// INSERT INTO profiles (id, full_name, role, bio, location, onboarding_complete)
// SELECT 
//   id,
//   'Test User',
//   'buyer',
//   'Food lover exploring the best home cooking in Lagos.',
//   'Victoria Island, Lagos',
//   true
// FROM auth.users WHERE email = 'test@food4love.demo'
// ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name;

// -- Daily specials for chefs
// INSERT INTO daily_specials (cook_id, title, description, price, available_until)
// SELECT 
//   p.id,
//   'Ofe Akwu Special',
//   'Palm fruit soup with assorted protein — goat, cow foot and stockfish. Served with pounded yam.',
//   9500,
//   now() + interval '24 hours'
// FROM profiles p WHERE p.full_name = 'Adaeze Okonkwo'
// ON CONFLICT DO NOTHING;

// INSERT INTO daily_specials (cook_id, title, description, price, available_until)
// SELECT 
//   p.id,
//   'Party Jollof Package',
//   'Long grain party jollof with grilled chicken, coleslaw and fried plantain for 2 people.',
//   18000,
//   now() + interval '24 hours'
// FROM profiles p WHERE p.full_name = 'Emeka Tochukwu'
// ON CONFLICT DO NOTHING;