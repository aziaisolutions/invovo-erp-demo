// vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// Yahan hum PWA ke master module ko shamil (import) kar rahe hain:
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    // Pehle se majood React ka plugin:
    react(),
    
    // Hamara naya shamil kiya hua PWA Configuration Setup:
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      manifest: {
        short_name: 'Smart Hisab',
        name: 'Smart Hisab - Shop Inventory & Khata SaaS',
        id: '/',
        start_url: '/',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        icons: [
          {
            src: '/pwa-192x192.png',
            type: 'image/png',
            sizes: '192x192',
            purpose: 'any maskable'
          },
          {
            src: '/pwa-512x512.png',
            type: 'image/png',
            sizes: '512x512',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ]
});
