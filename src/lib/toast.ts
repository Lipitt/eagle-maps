function getContainer(): HTMLElement {
  let el = document.getElementById('em-toaster')
  if (!el) {
    el = document.createElement('div')
    el.id = 'em-toaster'
    document.body.appendChild(el)
  }
  return el
}

function show(message: string, type: 'success' | 'error'): void {
  const container = getContainer()
  const el = document.createElement('div')
  el.className = `em-toast em-toast-${type}`
  el.textContent = message
  container.appendChild(el)

  requestAnimationFrame(() => {
    requestAnimationFrame(() => el.classList.add('em-toast-visible'))
  })

  setTimeout(() => {
    el.classList.remove('em-toast-visible')
    setTimeout(() => el.remove(), 300)
  }, 3000)
}

export const toast = {
  success: (msg: string) => show(msg, 'success'),
  error: (msg: string) => show(msg, 'error'),
}
