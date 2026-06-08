import { supabase } from './supabase'
import type { Restaurant, RestaurantInsert } from '@/types/restaurant'

export async function fetchRestaurants(): Promise<Restaurant[]> {
  const { data, error } = await supabase
    .from('restaurants')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data as Restaurant[]
}

export async function addRestaurant(restaurant: RestaurantInsert): Promise<Restaurant> {
  const { data, error } = await supabase
    .from('restaurants')
    .insert(restaurant)
    .select()
    .single()
  if (error) throw error
  return data as Restaurant
}

export async function deleteRestaurant(id: string): Promise<void> {
  const { error } = await supabase.from('restaurants').delete().eq('id', id)
  if (error) throw error
}
