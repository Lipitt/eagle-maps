import 'mapbox-gl/dist/mapbox-gl.css'
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css'
import './style.css'

import { supabase } from './lib/supabase'
import { setState } from './store'
import { setupRouter, addRoute, handleRoute } from './router'
import { mountMapPage } from './pages/map'
import { mountAuthPage } from './pages/auth'

async function init(): Promise<void> {
  // Resolve initial session before rendering anything
  const { data: { session } } = await supabase.auth.getSession()
  setState({ user: session?.user ?? null, session, authLoading: false })

  // Keep auth state in sync globally
  supabase.auth.onAuthStateChange((_event, session) => {
    setState({ user: session?.user ?? null, session })
  })

  const root = document.getElementById('root')!
  setupRouter(root)
  addRoute('/', mountMapPage)
  addRoute('/auth', mountAuthPage)
  handleRoute()
}

init()
