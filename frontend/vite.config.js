// =====================================================================
// vite.config.js – a Vite fejlesztői szerver és build beállításai
// =====================================================================

import { defineConfig } from 'vite';            // Vite konfiguráció segédfüggvény
import react from '@vitejs/plugin-react';       // React (JSX) támogatás

export default defineConfig({                   // a beállítások
  plugins: [react()],                           // JSX fordítás és gyors frissítés fejlesztés közben
  server: {                                     // fejlesztői szerver (npm run dev)
    port: 5173,                                 // ezen a porton fut: http://localhost:5173
    fs: { allow: ['..'] },                      // a ../shared mappát is olvashatja (közös fit-config.json)
    proxy: {                                    // a /api kéréseket a PHP szerverhez továbbítja
      '/api': process.env.VITE_API_PROXY || 'http://localhost:8000', // alapból a "php -S localhost:8000" szerver
    },                                          // proxy vége
  },                                            // server vége
  build: {                                      // éles build (npm run build)
    outDir: 'dist',                             // ide kerül a kész oldal
    chunkSizeWarningLimit: 1500,                // a Three.js nagy, ezért a figyelmeztetési határ magasabb
  },                                            // build vége
});                                             // konfiguráció vége
