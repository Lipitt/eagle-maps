import { getState, setState, subscribe } from '@/store'
import { fetchRestaurants, addRestaurant, deleteRestaurant } from '@/lib/api'
import { applyFilters } from '@/lib/filters'
import { toast } from '@/lib/toast'
import { createNavbar } from '@/components/navbar'
import { createFilterPanel } from '@/components/filter-panel'
import { MapView } from '@/components/map-view'
import type { Filters } from '@/types/filters'

export function mountMapPage(container: HTMLElement): () => void {
  // ─── Layout shell ─────────────────────────────────────────────────────────────
  const page = document.createElement('div')
  page.className = 'page-map'
  container.appendChild(page)

  // ─── Navbar ───────────────────────────────────────────────────────────────────
  const navbar = createNavbar(page)

  // ─── Filter panel ─────────────────────────────────────────────────────────────
  const filterPanel = createFilterPanel(page, (filters: Filters) => {
    setState({ filters })
  })

  // ─── Map wrapper (fills the page, behind overlays) ────────────────────────────
  const mapWrapper = document.createElement('div')
  mapWrapper.className = 'map-wrapper'
  page.appendChild(mapWrapper)

  // ─── Map view ─────────────────────────────────────────────────────────────────
  const state = getState()

  const mapView = new MapView(
    mapWrapper,
    {
      onAdd: async (data) => {
        const s = getState()
        const newRestaurant = await addRestaurant({ ...data, created_by: s.user?.id ?? null })
        setState({ restaurants: [newRestaurant, ...s.restaurants] })
        toast.success('Restaurant added!')
      },
      onDelete: async (id) => {
        await deleteRestaurant(id)
        const s = getState()
        setState({ restaurants: s.restaurants.filter((r) => r.id !== id) })
        toast.success('Restaurant deleted.')
      },
      onDrawPolygon: (polygon) => {
        const s = getState()
        setState({ filters: { ...s.filters, polygon } })
      },
    },
    state.user !== null,
    state.user?.id ?? null,
  )

  // Seed with any restaurants already in store
  const initialFiltered = applyFilters(state.restaurants, state.filters)
  mapView.updateRestaurants(initialFiltered)
  navbar.update(state)
  filterPanel.update(state.filters, state.restaurants.length, initialFiltered.length)

  // ─── Fetch restaurants ────────────────────────────────────────────────────────
  fetchRestaurants()
    .then((restaurants) => setState({ restaurants }))
    .catch((err: Error) => toast.error(`Failed to load restaurants: ${err.message}`))

  // ─── Subscribe to state changes ───────────────────────────────────────────────
  const unsubscribe = subscribe((s) => {
    const filtered = applyFilters(s.restaurants, s.filters)
    mapView.updateRestaurants(filtered)
    mapView.updateAuth(s.user !== null, s.user?.id ?? null)
    navbar.update(s)
    filterPanel.update(s.filters, s.restaurants.length, filtered.length)
  })

  // ─── Unmount ──────────────────────────────────────────────────────────────────
  return () => {
    unsubscribe()
    mapView.destroy()
    container.innerHTML = ''
  }
}
