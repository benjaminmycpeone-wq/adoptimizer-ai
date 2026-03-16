import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/scrape': 'http://localhost:5055',
      '/ai-proxy': 'http://localhost:5055',
      '/api': 'http://localhost:5055',
      '/health': 'http://localhost:5055',
    }
  },
  build: {
    outDir: 'dist',
  }
})
