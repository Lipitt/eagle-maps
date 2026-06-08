import type { Filters } from '@/types/filters'
import type { Cuisine, PriceRange } from '@/types/restaurant'
import { DEFAULT_FILTERS } from '@/types/filters'

const CUISINES: Cuisine[] = [
  'italian', 'japanese', 'mexican', 'american',
  'chinese', 'indian', 'thai', 'mediterranean', 'other',
]
const CUISINE_EMOJI: Record<Cuisine, string> = {
  italian: '🍕', japanese: '🍣', mexican: '🌮', american: '🍔',
  chinese: '🥢', indian: '🍛', thai: '🍜', mediterranean: '🥗', other: '🍽️',
}
const PRICES: { value: PriceRange; label: string }[] = [
  { value: 1, label: '$' },
  { value: 2, label: '$$' },
  { value: 3, label: '$$$' },
]

export interface FilterPanelHandle {
  el: HTMLElement
  update(filters: Filters, total: number, filtered: number): void
}

export function createFilterPanel(
  parent: HTMLElement,
  onChange: (filters: Filters) => void,
): FilterPanelHandle {
  const el = document.createElement('div')
  el.className = 'filter-panel'
  parent.appendChild(el)

  let current: Filters = { ...DEFAULT_FILTERS }
  let totalCount = 0
  let filteredCount = 0

  function render(): void {
    el.innerHTML = ''

    // --- Cuisine toggles ---
    const cuisineGroup = document.createElement('div')
    cuisineGroup.className = 'filter-group'
    CUISINES.forEach((c) => {
      const btn = document.createElement('button')
      btn.className = 'filter-cuisine-btn' + (current.cuisines.includes(c) ? ' active' : '')
      btn.title = c
      btn.textContent = CUISINE_EMOJI[c]
      btn.addEventListener('click', () => {
        const next = current.cuisines.includes(c)
          ? current.cuisines.filter((x) => x !== c)
          : [...current.cuisines, c]
        onChange({ ...current, cuisines: next })
      })
      cuisineGroup.appendChild(btn)
    })
    el.appendChild(cuisineGroup)

    // --- Separator ---
    const sep1 = document.createElement('div')
    sep1.className = 'filter-sep'
    el.appendChild(sep1)

    // --- Rating stars ---
    const starGroup = document.createElement('div')
    starGroup.className = 'filter-group'
    ;[1, 2, 3, 4, 5].forEach((n) => {
      const btn = document.createElement('button')
      btn.className = 'filter-star-btn' + (n <= current.minRating ? ' active' : '')
      btn.textContent = '⭐'
      btn.addEventListener('click', () => {
        const next = current.minRating === n ? 1 : n
        onChange({ ...current, minRating: next })
      })
      starGroup.appendChild(btn)
    })
    if (current.minRating > 1) {
      const plus = document.createElement('span')
      plus.className = 'filter-rating-plus'
      plus.textContent = '+'
      starGroup.appendChild(plus)
    }
    el.appendChild(starGroup)

    // --- Separator ---
    const sep2 = document.createElement('div')
    sep2.className = 'filter-sep'
    el.appendChild(sep2)

    // --- Price range ---
    const priceGroup = document.createElement('div')
    priceGroup.className = 'filter-group'
    PRICES.forEach(({ value, label }) => {
      const btn = document.createElement('button')
      btn.className = 'filter-price-btn' + (current.priceRanges.includes(value) ? ' active' : '')
      btn.textContent = label
      btn.addEventListener('click', () => {
        const next = current.priceRanges.includes(value)
          ? current.priceRanges.filter((p) => p !== value)
          : [...current.priceRanges, value]
        onChange({ ...current, priceRanges: next })
      })
      priceGroup.appendChild(btn)
    })
    el.appendChild(priceGroup)

    // --- Count + clear ---
    const isFiltered =
      current.cuisines.length > 0 || current.minRating > 1 || current.priceRanges.length > 0
    if (isFiltered) {
      const results = document.createElement('div')
      results.className = 'filter-results'

      const badge = document.createElement('span')
      badge.className = 'filter-badge'
      badge.textContent = `${filteredCount} / ${totalCount}`

      const clearBtn = document.createElement('button')
      clearBtn.className = 'filter-clear-btn'
      clearBtn.textContent = 'Clear'
      clearBtn.addEventListener('click', () => onChange({ ...DEFAULT_FILTERS, polygon: current.polygon }))

      results.appendChild(badge)
      results.appendChild(clearBtn)
      el.appendChild(results)
    }
  }

  function update(filters: Filters, total: number, filtered: number): void {
    current = filters
    totalCount = total
    filteredCount = filtered
    render()
  }

  render()
  return { el, update }
}
