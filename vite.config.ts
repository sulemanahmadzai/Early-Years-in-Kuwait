import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // MapLibre and deck.gl are large by nature; the app is a single map page.
  build: { chunkSizeWarningLimit: 2000 },
});
