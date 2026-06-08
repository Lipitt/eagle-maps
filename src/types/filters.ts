import type { Feature, Polygon } from 'geojson'
import type { Cuisine, PriceRange } from './restaurant'

export interface Filters {
  cuisines: Cuisine[]
  minRating: number
  priceRanges: PriceRange[]
  polygon: Feature<Polygon> | null
}

export const DEFAULT_FILTERS: Filters = {
  cuisines: [],
  minRating: 1,
  priceRanges: [],
  polygon: null,
}
