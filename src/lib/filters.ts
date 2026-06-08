import booleanPointInPolygon from '@turf/boolean-point-in-polygon'
import { point } from '@turf/helpers'
import type { Restaurant } from '@/types/restaurant'
import type { Filters } from '@/types/filters'

export function applyFilters(restaurants: Restaurant[], filters: Filters): Restaurant[] {
  return restaurants.filter((r) => {
    if (filters.cuisines.length > 0 && !filters.cuisines.includes(r.cuisine)) return false
    if (r.rating < filters.minRating) return false
    if (filters.priceRanges.length > 0 && !filters.priceRanges.includes(r.price_range)) return false
    if (filters.polygon) {
      const pt = point([r.longitude, r.latitude])
      if (!booleanPointInPolygon(pt, filters.polygon)) return false
    }
    return true
  })
}
