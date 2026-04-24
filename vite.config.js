import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'icons/*.png'],
      manifest: {
        name: '競馬AI予想エージェント',
        short_name: 'KeibaAI',
        description: 'JRA・NAR 日本競馬 AI予想エージェント',
        theme_color: '#1a0a2e',
        background_color: '#1a0a2e',
        display: 'standalone',
        orientation: 'portrait-primary',
        scope: '/',
        start_url: '/',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        runtimeCaching: [
          { urlPattern: /^https:\/\/api\.anthropic\.com\/.*/i, handler: 'NetworkOnly' }
        ]
      }
    })
  ]
})
