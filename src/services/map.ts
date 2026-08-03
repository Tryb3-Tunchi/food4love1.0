import { createClient } from '@/lib/supabase/client'

export interface MapLocation {
  id: string
  lat: number
  lng: number
  name: string
  cuisine: string
  price: number
  emoji: string
  avatar_url: string | null
  rating: number | null
}

export async function getCookLocations() {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('profiles')
    .select(
      'id, full_name, location, cuisines, price_min, rating, avatar_url, lat, lng',
    )
    .eq('role', 'cook')
    .eq('kyc_status', 'verified')
    .not('lat', 'is', null)
    .not('lng', 'is', null)

  if (error) throw error

  return (data ?? []).map((cook): MapLocation => ({
    id: cook.id,
    lat: cook.lat,
    lng: cook.lng,
    name: cook.full_name ?? 'Chef',
    cuisine: cook.cuisines?.[0] ?? 'Nigerian',
    price: cook.price_min ?? 0,
    emoji: '🍽️',
    avatar_url: cook.avatar_url,
    rating: cook.rating,
  }))
}

export async function getCookById(cookId: string) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', cookId)
    .eq('role', 'cook')
    .single()

  if (error) throw error
  return data
}
