import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'mi-jardin-logo.png'],
      manifest: {
        name: 'Mi Jardín',
        short_name: 'Mi Jardín',
        description: 'Gestión Natural para tu Negocio',
        theme_color: '#4F7A5A',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: 'mi-jardin-logo.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'mi-jardin-logo.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'mi-jardin-logo.png',
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
