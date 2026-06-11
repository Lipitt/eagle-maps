import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { fetchRestaurants, addRestaurant, deleteRestaurant } from '@/lib/api'
import { applyFilters } from '@/lib/filters'
import { toast } from '@/lib/toast'
import { createNavbar } from '@/components/navbar'
import { createFilterPanel } from '@/components/filter-panel'
import type { FilterPanelHandle } from '@/components/filter-panel'
import { MapView } from '@/components/map-view'
import { DEFAULT_FILTERS } from '@/types/filters'
import type { Filters } from '@/types/filters'
import type { Restaurant } from '@/types/restaurant'

export function mountMapPage(container: HTMLElement): () => void {
  // ── Local state ────────────────────────────────────────────────────────────
  let restaurants: Restaurant[] = []
  let filters: Filters = { ...DEFAULT_FILTERS }
  let currentUser: User | null = null

  // ── Layout shell ───────────────────────────────────────────────────────────
  const page = document.createElement('div')
  page.className = 'page-map'
  container.appendChild(page)

  const navbar = createNavbar(page)

  // Map wrapper before filterPanel in the DOM — both are absolutely positioned,
  // filterPanel sits on top via z-index regardless of insertion order.
  const mapWrapper = document.createElement('div')
  mapWrapper.className = 'map-wrapper'
  page.appendChild(mapWrapper)

  // ── Map view ───────────────────────────────────────────────────────────────
  // filterPanel is declared with ! because its callbacks reference mapView,
  // and mapView callbacks reference filterPanel — both closures fire after
  // all synchronous setup is done, so both are assigned by then.
  let filterPanel!: FilterPanelHandle

  const mapView = new MapView(
    mapWrapper,
    {
      onAdd: async (data) => {
        const newRestaurant = await addRestaurant({ ...data, created_by: currentUser?.id ?? null })
        restaurants = [newRestaurant, ...restaurants]
        const filtered = applyFilters(restaurants, filters)
        mapView.updateRestaurants(filtered)
        filterPanel.update(filters, restaurants.length, filtered.length)
        toast.success('Restaurant added!')
      },
      onDelete: async (id) => {
        await deleteRestaurant(id)
        restaurants = restaurants.filter((r) => r.id !== id)
        const filtered = applyFilters(restaurants, filters)
        mapView.updateRestaurants(filtered)
        filterPanel.update(filters, restaurants.length, filtered.length)
        toast.success('Restaurant deleted.')
      },
      onDrawPolygon: (polygon) => {
        filters = { ...filters, polygon }
        const filtered = applyFilters(restaurants, filters)
        mapView.updateRestaurants(filtered)
        filterPanel.update(filters, restaurants.length, filtered.length)
      },
    },
    false,
    null,
  )

  // ── Filter panel ───────────────────────────────────────────────────────────
  filterPanel = createFilterPanel(page, (updated: Filters) => {
    filters = updated
    const filtered = applyFilters(restaurants, filters)
    mapView.updateRestaurants(filtered)
    filterPanel.update(filters, restaurants.length, filtered.length)
  })

  // ── Auth ───────────────────────────────────────────────────────────────────
  supabase.auth.getSession().then(({ data: { session } }) => {
    currentUser = session?.user ?? null
    navbar.update(currentUser)
    mapView.updateAuth(!!currentUser, currentUser?.id ?? null)
  })

  const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
    currentUser = session?.user ?? null
    navbar.update(currentUser)
    mapView.updateAuth(!!currentUser, currentUser?.id ?? null)
  })

  // ── Fetch restaurants ──────────────────────────────────────────────────────
  fetchRestaurants()
    .then((data) => {
      restaurants = data
      const filtered = applyFilters(restaurants, filters)
      mapView.updateRestaurants(filtered)
      filterPanel.update(filters, restaurants.length, filtered.length)
    })
    .catch((err: Error) => toast.error(`Failed to load restaurants: ${err.message}`))

  // ── Unmount ────────────────────────────────────────────────────────────────
  return () => {
    subscription.unsubscribe()
    mapView.destroy()
    container.innerHTML = ''
  }
}
