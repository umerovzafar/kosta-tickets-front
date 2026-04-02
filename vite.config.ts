import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
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
        target: 'http://localhost:1234',
        changeOrigin: true,
      },
      '/cbu-json': {
        target: 'https://cbu.uz',
        changeOrigin: true,
        secure: true,
        rewrite: p => p.replace(/^\/cbu-json/, ''),
      },
    },
  },
})
