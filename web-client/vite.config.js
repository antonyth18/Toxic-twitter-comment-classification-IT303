import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: true, // Exposes the server to the local network (needed for Docker mapping)
    watch: {
      usePolling: true, // Ensures hot reload works inside Docker containers
    }
  }
})
