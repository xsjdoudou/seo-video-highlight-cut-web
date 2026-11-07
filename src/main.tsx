import { StrictMode } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import App from './App'
import './styles.css'
import { seoPaths } from './seo'

const root = document.getElementById('root')!
const app = (
  <StrictMode>
    <App />
  </StrictMode>
)
if (root.hasChildNodes() && seoPaths.includes(window.location.pathname)) {
  hydrateRoot(root, app)
} else {
  createRoot(root).render(app)
}
