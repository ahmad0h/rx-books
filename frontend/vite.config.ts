import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// In development, /api calls are forwarded to the backend. In Docker the
// target is the backend container; when running locally it is localhost.
const apiTarget = process.env.API_PROXY_TARGET ?? 'http://localhost:3000'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': { target: apiTarget, changeOrigin: true },
    },
  },
})
