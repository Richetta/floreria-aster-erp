import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'aster-logo.png'],
      manifest: {
        name: 'Florería Aster ERP',
        short_name: 'Aster ERP',
        description: 'Punto de Venta y Gestión de Inventario para Florería Aster',
        theme_color: '#0f172a',
        icons: [
          {
            src: 'aster-logo.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'aster-logo.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'aster-logo.png',
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
