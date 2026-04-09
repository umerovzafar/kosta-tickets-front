import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import type { IncomingMessage, ServerResponse } from 'node:http'

/** Как в tickets-back/docs/FRONTEND_CONNECTION.md; переопределение: `VITE_PROXY_TARGET` в `.env` / `.env.local` */
const DEFAULT_PROXY_TARGET = 'http://127.0.0.1:1234'

function isCalendarStatusPath(url: string): boolean {
  return url.includes('/todos/calendar/status') || url.includes('calendar/status')
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const proxyTarget = (env.VITE_PROXY_TARGET || DEFAULT_PROXY_TARGET).replace(/\/$/, '')

  return {
    plugins: [react()],
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules/react-dom/')) return 'react-vendor'
            if (id.includes('node_modules/react/')) return 'react-vendor'
            if (id.includes('node_modules/react-router')) return 'router'
            if (id.includes('node_modules/recharts')) return 'recharts'
            if (id.includes('node_modules/exceljs')) return 'exceljs'
          },
        },
      },
    },
    define: {
      global: 'globalThis',
    },
    resolve: {
      alias: {
        '@app': path.resolve(__dirname, './src/app'),
        '@pages': path.resolve(__dirname, './src/pages'),
        '@widgets': path.resolve(__dirname, './src/widgets'),
        '@features': path.resolve(__dirname, './src/features'),
        '@entities': path.resolve(__dirname, './src/entities'),
        '@shared': path.resolve(__dirname, './src/shared'),
        buffer: 'buffer',
      },
    },
    server: {
      proxy: {
        '/api': {
          target: proxyTarget,
          changeOrigin: true,
          ws: true,
          configure(proxy) {
            proxy.on('error', (_err, req, res) => {
              const sr = res as ServerResponse | undefined
              if (!sr || typeof sr.writeHead !== 'function' || sr.headersSent) return
              const url = (req as IncomingMessage).url ?? ''
              const detail =
                `API шлюза недоступен (прокси Vite). Запустите gateway на ${proxyTarget}.`
              const payload: Record<string, unknown> = { detail }
              if (isCalendarStatusPath(url)) {
                payload.connected = false
              }
              sr.writeHead(503, { 'Content-Type': 'application/json; charset=utf-8' })
              sr.end(JSON.stringify(payload))
            })
          },
        },
        '/cbu-json': {
          target: 'https://cbu.uz',
          changeOrigin: true,
          secure: true,
          rewrite: p => p.replace(/^\/cbu-json/, ''),
        },
      },
    },
  }
})
