import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'logo-app.png'],
      manifest: {
        name: 'Mi Jardín',
        short_name: 'Mi Jardín',
        description: 'Gestión Natural para tu Negocio',
        theme_color: '#1a3c2a',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: 'logo-app.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'logo-app.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'logo-app.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ],
  build: {
    chunkSizeWarningLimit: 1000,
  },
})
