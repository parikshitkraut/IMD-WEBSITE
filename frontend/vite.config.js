import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    proxy: {
      '/api': 'http://localhost:3001',
      '/proxy-rmc': {
        target: 'https://www.imdnagpur.gov.in',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/proxy-rmc/, '')
      }
    }
  }
})
