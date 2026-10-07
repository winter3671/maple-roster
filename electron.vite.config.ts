import { fileURLToPath } from 'node:url'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const fromRoot = (path: string): string => fileURLToPath(new URL(path, import.meta.url))

export default defineConfig(({ command }) => ({
  main: {
    build: { rollupOptions: { input: fromRoot('./src/desktop/main/index.ts') } }
  },
  preload: {
    build: {
      rollupOptions: {
        input: fromRoot('./src/desktop/preload/index.ts'),
        output: { format: 'cjs', entryFileNames: '[name].cjs' }
      }
    }
  },
  renderer: {
    root: fromRoot('./src/frontend'),
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'renderer-content-security-policy',
        transformIndexHtml(html) {
          const policy =
            command === 'serve'
              ? "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' ws://localhost:* ws://127.0.0.1:*"
              : "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'"
          return html.replace('__CONTENT_SECURITY_POLICY__', policy)
        }
      }
    ],
    build: { rollupOptions: { input: fromRoot('./src/frontend/index.html') } }
  }
}))
