import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

// NOTE: GEMINI_API_KEY is intentionally NOT exposed to the client bundle.
// All Gemini calls now go through the Express server (see server/geminiApi.ts)
// which reads the key from process.env at runtime.
export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify - file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
    build: {
      rollupOptions: {
        output: {
          // Split stable vendor code into separate chunks so browsers can cache
          // them independently from the frequently-changing app code.
          manualChunks: {
            'vendor-react':  ['react', 'react-dom'],
            'vendor-motion': ['motion'],
            'vendor-icons':  ['lucide-react'],
            'vendor-misc':   ['canvas-confetti', 'react-markdown'],
          },
        },
      },
    },
  };
});
