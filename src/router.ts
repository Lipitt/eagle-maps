// Mounter receives a container element and returns a cleanup/unmount function.
type Mounter = (container: HTMLElement) => () => void

const routes = new Map<string, Mounter>()
let currentUnmount: (() => void) | null = null
let rootEl: HTMLElement

export function setupRouter(root: HTMLElement): void {
  rootEl = root
  window.addEventListener('popstate', () => handleRoute())
}

export function addRoute(path: string, mounter: Mounter): void {
  routes.set(path, mounter)
}

export function navigate(path: string): void {
  window.history.pushState({}, '', path)
  handleRoute()
}

export function handleRoute(): void {
  if (currentUnmount) {
    currentUnmount()
    currentUnmount = null
  }
  rootEl.innerHTML = ''

  const path = window.location.pathname
  const mounter = routes.get(path) ?? routes.get('/')!
  currentUnmount = mounter(rootEl)
}
