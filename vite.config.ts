import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

const root = path.dirname(fileURLToPath(import.meta.url))

/**
 * Static sites kept in public/ (like public/nsyte/) open at /nsyte/ on GitHub Pages.
 * The dev server doesn't do that on its own, so this makes `npm run dev` match.
 */
function publicFolderIndex(): Plugin {
  return {
    name: 'public-folder-index',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        const [pathname, query] = (req.url ?? '').split('?')
        if (pathname.endsWith('/') && pathname !== '/') {
          const file = path.join(server.config.publicDir, decodeURIComponent(pathname), 'index.html')
          if (fs.existsSync(file)) req.url = pathname + 'index.html' + (query ? `?${query}` : '')
        }
        next()
      })
    },
  }
}

/**
 * The dev preview (built with SITE_ENV=dev, published at /dev/): keep it out of search engines and
 * put a small DEV tag in the corner so it's never mistaken for the live site.
 */
function devPreview(): Plugin {
  return {
    name: 'dev-preview',
    apply: 'build',
    transformIndexHtml(html) {
      if (process.env.SITE_ENV !== 'dev') return html
      return html
        .replace('<head>', '<head>\n    <meta name="robots" content="noindex, nofollow" />')
        .replace(
          '</body>',
          '  <div aria-hidden="true" style="position:fixed;right:8px;bottom:8px;z-index:2147483647;pointer-events:none;' +
            'background:#f15b49;color:#1d262c;font:700 12px/1 system-ui,sans-serif;letter-spacing:.12em;padding:6px 8px;' +
            'border:2px solid #1d262c;border-top:0;opacity:.9">DEV</div>\n  </body>',
        )
    },
  }
}

// BASE_PATH: "/" for the live site; the dev preview builds with "/dev/".
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  plugins: [publicFolderIndex(), devPreview(), react(), tailwindcss()],
  build: {
    rollupOptions: {
      // Two pages: the portfolio (/) and the about / resume page (/about/).
      input: {
        main: path.resolve(root, 'index.html'),
        about: path.resolve(root, 'about/index.html'),
      },
    },
  },
})
