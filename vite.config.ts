import fs from 'node:fs'
import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

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

// BASE_PATH lets the GitHub Actions build serve from https://USER.github.io/REPO/
// while testing. Once the custom domain is live, it stays "/" (the default).
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  plugins: [publicFolderIndex(), react(), tailwindcss()],
})
