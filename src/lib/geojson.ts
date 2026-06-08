import type { FeatureCollection, Point } from 'geojson'
import type { Restaurant } from '@/types/restaurant'

const CUISINE_EMOJI: Record<string, string> = {
  italian: '🍕',
  japanese: '🍣',
  mexican: '🌮',
  american: '🍔',
  chinese: '🥢',
  indian: '🍛',
  thai: '🍜',
  mediterranean: '🥗',
  other: '🍽️',
}

export function restaurantsToGeoJSON(restaurants: Restaurant[]): FeatureCollection<Point> {
  return {
    type: 'FeatureCollection',
    features: restaurants.map((r) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [r.longitude, r.latitude] },
      properties: { ...r, emoji: CUISINE_EMOJI[r.cuisine] ?? '🍽️' },
    })),
  }
}
