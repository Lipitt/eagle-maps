import mapboxgl from 'mapbox-gl'
import MapboxDraw from '@mapbox/mapbox-gl-draw'
import type { Feature, Polygon } from 'geojson'
import type { Restaurant, RestaurantFormData } from '@/types/restaurant'
import { restaurantsToGeoJSON } from '@/lib/geojson'
import { showRestaurantFormDialog } from './restaurant-form'

const CLUSTER_MAX_ZOOM = 14

const CUISINE_EMOJI: Record<string, string> = {
  italian: '🍕', japanese: '🍣', mexican: '🌮', american: '🍔',
  chinese: '🥢', indian: '🍛', thai: '🍜', mediterranean: '🥗', other: '🍽️',
}
const PRICE_LABEL: Record<number, string> = { 1: '$', 2: '$$', 3: '$$$' }

export interface MapViewCallbacks {
  onAdd: (data: RestaurantFormData) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onDrawPolygon: (polygon: Feature<Polygon> | null) => void
}

export class MapView {
  private map: mapboxgl.Map
  private draw!: MapboxDraw
  private markers: mapboxgl.Marker[] = []
  private activePopup: mapboxgl.Popup | null = null
  private tooltip: HTMLElement
  private controlsEl: HTMLElement

  private restaurants: Restaurant[] = []
  private isAuthenticated: boolean
  private currentUserId: string | null
  private callbacks: MapViewCallbacks

  // Interaction guards
  private isDrawing = false
  private justFinishedDraw = false

  // Map view state
  private showHeatmap = false
  private is3D = false
  private zoom = 13

  // Hover state for neighborhood
  private hoveredNeighborhoodId: string | null = null

  constructor(
    wrapper: HTMLElement,
    callbacks: MapViewCallbacks,
    isAuthenticated: boolean,
    currentUserId: string | null,
  ) {
    this.callbacks = callbacks
    this.isAuthenticated = isAuthenticated
    this.currentUserId = currentUserId

    // Inner map container (fills the wrapper)
    const mapEl = document.createElement('div')
    mapEl.style.cssText = 'position:absolute;inset:0;'
    wrapper.appendChild(mapEl)

    // Controls overlay (bottom-left, above map)
    this.controlsEl = document.createElement('div')
    this.controlsEl.className = 'map-controls'
    wrapper.appendChild(this.controlsEl)

    // Neighborhood tooltip (appended to body so it isn't clipped)
    this.tooltip = document.createElement('div')
    this.tooltip.className = 'neighborhood-tooltip'
    document.body.appendChild(this.tooltip)

    // Init Mapbox
    this.map = new mapboxgl.Map({
      container: mapEl,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [-58.3816, -34.6037],
      zoom: 13,
      accessToken: import.meta.env.VITE_MAPBOX_TOKEN as string,
      doubleClickZoom: false,
    })

    this.map.addControl(new mapboxgl.NavigationControl(), 'top-right')
    this.map.addControl(new mapboxgl.ScaleControl(), 'bottom-right')

    // Cursor
    this.setCursor()
    this.map.on('mouseenter', 'clusters', () => {
      this.map.getCanvas().style.cursor = 'pointer'
    })
    this.map.on('mouseleave', 'clusters', () => this.setCursor())

    // Zoom tracking
    this.map.on('zoom', () => {
      this.zoom = this.map.getZoom()
      this.updateMarkers()
    })

    // Map click
    this.map.on('click', (e) => this.handleMapClick(e))

    // Neighborhood hover
    this.map.on('mousemove', 'neighborhoods-fill', (e) => {
      const feature = e.features?.[0]
      if (!feature) return
      const id: string = feature.properties?.id ?? null
      if (id !== this.hoveredNeighborhoodId) {
        this.hoveredNeighborhoodId = id
        this.updateNeighborhoodHover()
      }
      const name: string = feature.properties?.nombre ?? ''
      if (name) {
        this.tooltip.textContent = name
        this.tooltip.style.display = 'block'
        this.tooltip.style.left = e.originalEvent.clientX + 12 + 'px'
        this.tooltip.style.top = e.originalEvent.clientY - 28 + 'px'
      }
    })
    this.map.on('mouseleave', 'neighborhoods-fill', () => {
      this.hoveredNeighborhoodId = null
      this.updateNeighborhoodHover()
      this.tooltip.style.display = 'none'
    })

    this.map.on('load', () => this.onMapLoad())

    this.renderControls()
  }

  // ─── Map load ───────────────────────────────────────────────────────────────

  private onMapLoad(): void {
    const empty: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] }

    // Buenos Aires neighbourhoods
    this.map.addSource('ba-barrios', { type: 'geojson', data: '/ba-barrios.geojson' })
    this.map.addLayer({
      id: 'neighborhoods-fill',
      type: 'fill',
      source: 'ba-barrios',
      paint: { 'fill-color': '#6366f1', 'fill-opacity': 0 },
    })
    this.map.addLayer({
      id: 'neighborhoods-line',
      type: 'line',
      source: 'ba-barrios',
      paint: { 'line-color': '#6366f1', 'line-width': 0.5, 'line-opacity': 0.4 },
    })

    // 3-D buildings
    this.map.addSource('buildings', { type: 'vector', url: 'mapbox://mapbox.mapbox-streets-v8' })
    this.map.addLayer({
      id: '3d-buildings',
      source: 'buildings',
      'source-layer': 'building',
      type: 'fill-extrusion',
      minzoom: 14,
      filter: ['==', 'extrude', 'true'],
      layout: { visibility: 'none' },
      paint: {
        'fill-extrusion-color': '#aaa',
        'fill-extrusion-height': ['get', 'height'],
        'fill-extrusion-base': ['get', 'min_height'],
        'fill-extrusion-opacity': 0.6,
      },
    })

    // Heatmap source
    this.map.addSource('restaurants-heatmap', { type: 'geojson', data: empty })
    this.map.addLayer({
      id: 'heatmap',
      type: 'heatmap',
      source: 'restaurants-heatmap',
      layout: { visibility: 'none' },
      paint: {
        'heatmap-weight': 1,
        'heatmap-intensity': 1,
        'heatmap-radius': 30,
        'heatmap-color': [
          'interpolate', ['linear'], ['heatmap-density'],
          0, 'rgba(0,0,255,0)',
          0.2, 'royalblue',
          0.4, 'cyan',
          0.6, 'lime',
          0.8, 'yellow',
          1, 'red',
        ],
        'heatmap-opacity': 0.7,
      },
    })

    // Clustered restaurant points
    this.map.addSource('restaurants', {
      type: 'geojson',
      data: empty,
      cluster: true,
      clusterMaxZoom: CLUSTER_MAX_ZOOM,
      clusterRadius: 50,
    })
    this.map.addLayer({
      id: 'clusters',
      type: 'circle',
      source: 'restaurants',
      filter: ['has', 'point_count'],
      layout: { visibility: 'visible' },
      paint: {
        'circle-color': ['step', ['get', 'point_count'], '#6366f1', 5, '#8b5cf6', 15, '#ec4899'],
        'circle-radius': ['step', ['get', 'point_count'], 18, 5, 24, 15, 32],
        'circle-opacity': 0.85,
      },
    })
    this.map.addLayer({
      id: 'cluster-count',
      type: 'symbol',
      source: 'restaurants',
      filter: ['has', 'point_count'],
      layout: {
        visibility: 'visible',
        'text-field': '{point_count_abbreviated}',
        'text-size': 13,
        'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
      },
      paint: { 'text-color': '#ffffff' },
    })

    // MapboxDraw for polygon filter
    this.draw = new MapboxDraw({
      displayControlsDefault: false,
      controls: { polygon: true, trash: true },
    })
    this.map.addControl(this.draw)

    this.map.on('draw.create', () => {
      const polygon = this.draw.getAll().features[0] as Feature<Polygon> | undefined
      if (polygon) {
        this.callbacks.onDrawPolygon(polygon)
        this.justFinishedDraw = true
      }
    })
    this.map.on('draw.update', () => {
      const polygon = this.draw.getAll().features[0] as Feature<Polygon> | undefined
      if (polygon) this.callbacks.onDrawPolygon(polygon)
    })
    this.map.on('draw.delete', () => this.callbacks.onDrawPolygon(null))
    this.map.on('draw.modechange', () => {
      this.isDrawing = this.draw.getMode() === 'draw_polygon'
    })

    // Seed with any data that arrived before the map loaded
    if (this.restaurants.length > 0) this.applyData()
  }

  // ─── Map interaction ─────────────────────────────────────────────────────────

  private handleMapClick(e: mapboxgl.MapMouseEvent): void {
    if (this.isDrawing) return
    if (this.justFinishedDraw) { this.justFinishedDraw = false; return }

    // Cluster expansion
    const clusterFeatures = this.map.queryRenderedFeatures(e.point, { layers: ['clusters'] })
    if (clusterFeatures.length > 0) {
      const feature = clusterFeatures[0]
      const clusterId = feature.properties?.cluster_id as number
      const source = this.map.getSource('restaurants') as mapboxgl.GeoJSONSource
      source.getClusterExpansionZoom(clusterId, (err, zoom) => {
        if (err || zoom == null) return
        const coords = (feature.geometry as GeoJSON.Point).coordinates as [number, number]
        this.map.easeTo({ center: coords, zoom })
      })
      return
    }

    if (this.isAuthenticated) {
      this.closePopup()
      showRestaurantFormDialog({
        coordinates: { latitude: e.lngLat.lat, longitude: e.lngLat.lng },
        onSubmit: (data) => this.callbacks.onAdd(data),
      })
    }
  }

  // ─── Data ────────────────────────────────────────────────────────────────────

  private applyData(): void {
    // Sources are added in onMapLoad — if they don't exist yet, bail and wait.
    // Deliberately not using isStyleLoaded(): in Mapbox GL v3 that method checks
    // pending tile requests too, so it can return false even inside the load handler.
    if (!this.map.getSource('restaurants')) return
    const geojson = restaurantsToGeoJSON(this.restaurants)
    ;(this.map.getSource('restaurants') as mapboxgl.GeoJSONSource).setData(geojson)
    ;(this.map.getSource('restaurants-heatmap') as mapboxgl.GeoJSONSource).setData(geojson)
    this.updateMarkers()
  }

  private updateMarkers(): void {
    this.markers.forEach((m) => m.remove())
    this.markers = []

    const show = this.zoom >= CLUSTER_MAX_ZOOM && !this.showHeatmap
    if (!show) return

    this.restaurants.forEach((r) => {
      const el = document.createElement('div')
      el.className = 'map-marker'
      el.textContent = CUISINE_EMOJI[r.cuisine] ?? '🍽️'
      el.addEventListener('click', (e) => {
        e.stopPropagation()
        this.showPopup(r)
      })

      const marker = new mapboxgl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([r.longitude, r.latitude])
        .addTo(this.map)
      this.markers.push(marker)
    })
  }

  // ─── Popup ───────────────────────────────────────────────────────────────────

  private showPopup(restaurant: Restaurant): void {
    this.closePopup()
    const canDelete = !!this.currentUserId && restaurant.created_by === this.currentUserId

    const container = document.createElement('div')
    container.className = 'restaurant-popup'

    const h3 = document.createElement('h3')
    h3.textContent = restaurant.name
    container.appendChild(h3)

    const meta = document.createElement('div')
    meta.className = 'popup-meta'

    const badge = document.createElement('span')
    badge.className = 'popup-cuisine-badge'
    badge.textContent = restaurant.cuisine

    const price = document.createElement('span')
    price.textContent = PRICE_LABEL[restaurant.price_range] ?? ''

    const stars = document.createElement('span')
    stars.textContent = '⭐'.repeat(restaurant.rating)

    meta.appendChild(badge)
    meta.appendChild(price)
    meta.appendChild(stars)
    container.appendChild(meta)

    if (restaurant.notes) {
      const notes = document.createElement('p')
      notes.className = 'popup-notes'
      notes.textContent = restaurant.notes
      container.appendChild(notes)
    }
    if (restaurant.address) {
      const addr = document.createElement('p')
      addr.className = 'popup-address'
      addr.textContent = '📍 ' + restaurant.address
      container.appendChild(addr)
    }

    if (canDelete) {
      const deleteBtn = document.createElement('button')
      deleteBtn.className = 'btn btn-danger btn-sm popup-delete-btn'
      deleteBtn.textContent = 'Delete'

      const confirmEl = document.createElement('div')
      confirmEl.className = 'popup-confirm'
      confirmEl.style.display = 'none'

      const confirmText = document.createElement('p')
      confirmText.textContent = `Delete "${restaurant.name}"?`
      confirmEl.appendChild(confirmText)

      const confirmActions = document.createElement('div')
      confirmActions.className = 'popup-confirm-actions'

      const yesBtn = document.createElement('button')
      yesBtn.className = 'btn btn-danger btn-sm'
      yesBtn.textContent = 'Delete'
      yesBtn.addEventListener('click', async () => {
        yesBtn.disabled = true
        yesBtn.textContent = 'Deleting…'
        try {
          await this.callbacks.onDelete(restaurant.id)
          this.closePopup()
        } catch {
          yesBtn.disabled = false
          yesBtn.textContent = 'Delete'
        }
      })

      const noBtn = document.createElement('button')
      noBtn.className = 'btn btn-outline btn-sm'
      noBtn.textContent = 'Cancel'
      noBtn.addEventListener('click', () => {
        confirmEl.style.display = 'none'
        deleteBtn.style.display = ''
      })

      confirmActions.appendChild(yesBtn)
      confirmActions.appendChild(noBtn)
      confirmEl.appendChild(confirmActions)

      deleteBtn.addEventListener('click', () => {
        deleteBtn.style.display = 'none'
        confirmEl.style.display = 'block'
      })

      container.appendChild(deleteBtn)
      container.appendChild(confirmEl)
    }

    this.activePopup = new mapboxgl.Popup({ offset: 40, closeButton: true })
      .setLngLat([restaurant.longitude, restaurant.latitude])
      .setDOMContent(container)
      .addTo(this.map)

    this.activePopup.on('close', () => { this.activePopup = null })
  }

  private closePopup(): void {
    this.activePopup?.remove()
    this.activePopup = null
  }

  // ─── Neighbourhood hover ──────────────────────────────────────────────────────

  private updateNeighborhoodHover(): void {
    if (!this.map.getLayer('neighborhoods-fill')) return
    const id = this.hoveredNeighborhoodId
    this.map.setPaintProperty(
      'neighborhoods-fill',
      'fill-opacity',
      id ? ['case', ['==', ['get', 'id'], id], 0.2, 0] : 0,
    )
    this.map.setPaintProperty(
      'neighborhoods-line',
      'line-width',
      id ? ['case', ['==', ['get', 'id'], id], 2, 0.5] : 0.5,
    )
  }

  // ─── Controls ────────────────────────────────────────────────────────────────

  private renderControls(): void {
    this.controlsEl.innerHTML = ''

    const heatBtn = document.createElement('button')
    heatBtn.className = 'btn btn-sm ' + (this.showHeatmap ? 'btn-primary' : 'btn-outline')
    heatBtn.textContent = this.showHeatmap ? '🔵 Clusters' : '🌡️ Heatmap'
    heatBtn.addEventListener('click', () => {
      this.showHeatmap = !this.showHeatmap
      if (this.map.getSource('restaurants')) {
        this.map.setLayoutProperty('heatmap', 'visibility', this.showHeatmap ? 'visible' : 'none')
        this.map.setLayoutProperty('clusters', 'visibility', this.showHeatmap ? 'none' : 'visible')
        this.map.setLayoutProperty('cluster-count', 'visibility', this.showHeatmap ? 'none' : 'visible')
      }
      this.updateMarkers()
      this.renderControls()
    })

    const tdBtn = document.createElement('button')
    tdBtn.className = 'btn btn-sm ' + (this.is3D ? 'btn-primary' : 'btn-outline')
    tdBtn.textContent = this.is3D ? '🗺️ 2D' : '🏙️ 3D'
    tdBtn.addEventListener('click', () => {
      this.is3D = !this.is3D
      if (this.map.getSource('buildings')) {
        this.map.setLayoutProperty('3d-buildings', 'visibility', this.is3D ? 'visible' : 'none')
      }
      this.map.easeTo({ pitch: this.is3D ? 45 : 0, bearing: this.is3D ? -10 : 0, duration: 800 })
      this.renderControls()
    })

    this.controlsEl.appendChild(heatBtn)
    this.controlsEl.appendChild(tdBtn)
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  private setCursor(): void {
    this.map.getCanvas().style.cursor = this.isAuthenticated ? 'crosshair' : 'default'
  }

  // ─── Public API ──────────────────────────────────────────────────────────────

  updateRestaurants(restaurants: Restaurant[]): void {
    this.restaurants = restaurants
    this.applyData()
  }

  updateAuth(isAuthenticated: boolean, currentUserId: string | null): void {
    this.isAuthenticated = isAuthenticated
    this.currentUserId = currentUserId
    this.setCursor()
  }

  destroy(): void {
    this.markers.forEach((m) => m.remove())
    this.closePopup()
    this.tooltip.remove()
    this.map.remove()
  }
}
