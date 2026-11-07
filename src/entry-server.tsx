import { renderToString } from 'react-dom/server'
import App from './App'

export { pageSeo } from './seo'

export function render(path: string): string {
  return renderToString(<App initialPath={path} />)
}
