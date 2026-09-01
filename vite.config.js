// vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// Importing the master PWA module:
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    // Existing React plugin:
    react(),
    
    // Our newly integrated PWA Configuration Setup:
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      manifest: {
        short_name: 'Invovo ERP',
        name: 'Invovo ERP - Cloud Inventory & POS SaaS',
        id: '/',
        start_url: '/',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        icons: [
          {
            src: '/icon-192.png',
            type: 'image/png',
            sizes: '192x192',
            purpose: 'any maskable'
          },
          {
            src: '/icon-512.png',
            type: 'image/png',
            sizes: '512x512',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ]
});
