import { readFile, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const dist = process.argv[2] || 'dist'
const serverEntry = process.argv[3] || '.prerender/entry-server.js'
const { render, pageSeo } = await import(pathToFileURL(resolve(serverEntry)).href)
const html = await readFile(join(dist, 'index.html'), 'utf8')

function replaceRequired(input, pattern, replacement) {
  if (!pattern.test(input)) throw new Error(`Missing HTML placeholder: ${pattern}`)
  return input.replace(pattern, () => replacement)
}

function escapeAttribute(value) {
  return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;')
}

for (const path of ['/', '/pricing', '/how-it-works']) {
  const seo = pageSeo(path)
  let page = replaceRequired(html, /<title>[^<]*<\/title>/, `<title>${escapeAttribute(seo.title)}</title>`)
  page = replaceRequired(page, /<link rel="canonical" href="[^"]*" ?\/>/, `<link rel="canonical" href="${seo.canonical}" />`)
  page = replaceRequired(page, /<meta\s+name="description"\s+content="[^"]*"\s*\/>/, `<meta name="description" content="${escapeAttribute(seo.description)}" />`)
  page = replaceRequired(page, /<meta property="og:title" content="[^"]*" ?\/>/, `<meta property="og:title" content="${escapeAttribute(seo.title)}" />`)
  page = replaceRequired(page, /<meta\s+property="og:description"\s+content="[^"]*"\s*\/>/, `<meta property="og:description" content="${escapeAttribute(seo.description)}" />`)
  page = replaceRequired(page, /<div id="root"><\/div>/, `<div id="root">${render(path)}</div>`)
  await writeFile(join(dist, path === '/' ? 'index.html' : `${path.slice(1)}.html`), page)
}
