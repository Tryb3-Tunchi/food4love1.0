// Lightweight mock data for pages that expect demo chefs/locations
export const MOCK_CHEFS: any[] = [
  {
    id: "demo-1",
    name: "Chioma",
    nickname: "Chioma",
    role: "cook",
    looking_for: "Food dates and loyal customers",
    age: 26,
    avatar_url:
      "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=1200&q=80",
    bio: "If you love smoky jollof, soft plantain, and proper stew… you're in the right place.",
    cuisines: ["Nigerian"],
    interests: ["Home cooking", "Spicy", "Street food"],
    favorite_foods: ["Jollof Rice", "Fried Plantain", "Chicken"],
    photos: [],
    specialty: "Jollof Rice",
    price_min: 2500,
    price_max: 7000,
    is_bot: false,
    kyc_status: "verified",
    lat: 6.4541,
    lng: 3.3947,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "demo-2",
    name: "Tunde",
    nickname: "Tunde",
    role: "cook",
    looking_for: "Late-night suya and good vibes",
    age: 29,
    avatar_url:
      "https://images.unsplash.com/photo-1544723795-3fb6469f5b39?auto=format&fit=crop&w=1200&q=80",
    bio: "Proper suya, hot yaji, and cold drinks. Come chop.",
    cuisines: ["Nigerian"],
    interests: ["Street food", "BBQ", "Spicy"],
    favorite_foods: ["Suya", "Peppered Snail", "Asun"],
    photos: [],
    specialty: "Suya",
    price_min: 2000,
    price_max: 6000,
    is_bot: false,
    kyc_status: "verified",
    lat: 6.46,
    lng: 3.41,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  // Keep a small set; components only need id and a few fields
];

export const MOCK_MAP_LOCATIONS: any[] = MOCK_CHEFS.map((c) => ({
  id: c.id,
  lat: c.lat,
  lng: c.lng,
  title: c.name ?? c.nickname,
}));
