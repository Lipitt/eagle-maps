export type Cuisine =
  | 'italian'
  | 'japanese'
  | 'mexican'
  | 'american'
  | 'chinese'
  | 'indian'
  | 'thai'
  | 'mediterranean'
  | 'other'

export type PriceRange = 1 | 2 | 3

export interface Restaurant {
  id: string
  name: string
  cuisine: Cuisine
  rating: number
  price_range: PriceRange
  notes: string
  address: string
  latitude: number
  longitude: number
  created_by: string | null
  created_at: string
}

export type RestaurantInsert = Omit<Restaurant, 'id' | 'created_at'>
export type RestaurantFormData = Omit<RestaurantInsert, 'created_by'>
