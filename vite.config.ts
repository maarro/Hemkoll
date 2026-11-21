import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// base './' gör att bygget fungerar både lokalt och från HA:s /local/hemkoll/
export default defineConfig({
  base: './',
  plugins: [react()],
  server: { host: true },
})
