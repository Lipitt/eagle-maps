import { z } from 'zod'
import type { RestaurantFormData } from '@/types/restaurant'

const CUISINES = [
  'italian', 'japanese', 'mexican', 'american',
  'chinese', 'indian', 'thai', 'mediterranean', 'other',
] as const

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  cuisine: z.enum(CUISINES),
  rating: z.number().min(1).max(5),
  price_range: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  notes: z.string(),
  address: z.string(),
  latitude: z.number(),
  longitude: z.number(),
})

interface DialogOptions {
  coordinates: { latitude: number; longitude: number }
  onSubmit: (data: RestaurantFormData) => Promise<void>
}

export function showRestaurantFormDialog({ coordinates, onSubmit }: DialogOptions): void {
  // Backdrop
  const backdrop = document.createElement('div')
  backdrop.className = 'modal-backdrop'

  const content = document.createElement('div')
  content.className = 'modal-content'

  const title = document.createElement('div')
  title.className = 'modal-title'
  title.textContent = 'Add a restaurant'
  content.appendChild(title)

  // Form HTML (using native select elements for simplicity)
  const form = document.createElement('form')
  form.innerHTML = `
    <div class="form-group">
      <label class="form-label" for="r-name">Name</label>
      <input id="r-name" name="name" class="form-input" placeholder="Restaurant name" autocomplete="off" />
      <span class="form-error" id="err-name"></span>
    </div>
    <div class="form-group">
      <label class="form-label" for="r-cuisine">Cuisine</label>
      <select id="r-cuisine" name="cuisine" class="form-select">
        ${CUISINES.map((c) => `<option value="${c}"${c === 'other' ? ' selected' : ''}>${c[0].toUpperCase() + c.slice(1)}</option>`).join('')}
      </select>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label" for="r-rating">Rating</label>
        <select id="r-rating" name="rating" class="form-select">
          <option value="1">⭐</option>
          <option value="2">⭐⭐</option>
          <option value="3" selected>⭐⭐⭐</option>
          <option value="4">⭐⭐⭐⭐</option>
          <option value="5">⭐⭐⭐⭐⭐</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label" for="r-price">Price</label>
        <select id="r-price" name="price_range" class="form-select">
          <option value="1">$ — Cheap</option>
          <option value="2" selected>$$ — Moderate</option>
          <option value="3">$$$ — Expensive</option>
        </select>
      </div>
    </div>
    <div class="form-group">
      <label class="form-label" for="r-address">Address</label>
      <input id="r-address" name="address" class="form-input" placeholder="Optional" autocomplete="off" />
    </div>
    <div class="form-group">
      <label class="form-label" for="r-notes">Notes</label>
      <textarea id="r-notes" name="notes" class="form-textarea" placeholder="What did you love about it?"></textarea>
    </div>
    <input type="hidden" name="latitude" value="${coordinates.latitude}" />
    <input type="hidden" name="longitude" value="${coordinates.longitude}" />
    <div class="form-actions">
      <button type="button" class="btn btn-outline" id="r-cancel">Cancel</button>
      <button type="submit" class="btn btn-primary" id="r-submit">Add Restaurant</button>
    </div>
  `

  const close = () => backdrop.remove()

  form.addEventListener('submit', async (e) => {
    e.preventDefault()

    // Clear previous errors
    form.querySelectorAll('.form-error').forEach((el) => (el.textContent = ''))

    const fd = new FormData(form)
    const raw = Object.fromEntries(fd.entries())

    const result = schema.safeParse({
      name: raw.name,
      cuisine: raw.cuisine,
      rating: Number(raw.rating),
      price_range: Number(raw.price_range),
      notes: raw.notes ?? '',
      address: raw.address ?? '',
      latitude: Number(raw.latitude),
      longitude: Number(raw.longitude),
    })

    if (!result.success) {
      result.error.issues.forEach((issue) => {
        const field = String(issue.path[0])
        const errEl = form.querySelector(`#err-${field}`)
        if (errEl) errEl.textContent = issue.message
      })
      return
    }

    const submitBtn = form.querySelector<HTMLButtonElement>('#r-submit')!
    submitBtn.disabled = true
    submitBtn.textContent = 'Saving...'

    try {
      const { latitude, longitude, ...formData } = result.data
      void latitude; void longitude; // included in result but typed in RestaurantFormData
      await onSubmit(result.data as RestaurantFormData)
      close()
    } catch {
      submitBtn.disabled = false
      submitBtn.textContent = 'Add Restaurant'
    }
  })

  form.querySelector('#r-cancel')!.addEventListener('click', close)
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) close()
  })

  content.appendChild(form)
  backdrop.appendChild(content)
  document.body.appendChild(backdrop)

  // Focus the name field
  setTimeout(() => form.querySelector<HTMLInputElement>('#r-name')?.focus(), 50)
}
