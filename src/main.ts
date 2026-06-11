import 'mapbox-gl/dist/mapbox-gl.css'
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css'
import './style.css'

import { setupRouter, addRoute, handleRoute } from './router'
import { mountMapPage } from './pages/map'
import { mountAuthPage } from './pages/auth'

const root = document.getElementById('root')!
setupRouter(root)
addRoute('/', mountMapPage)
addRoute('/auth', mountAuthPage)
handleRoute()
