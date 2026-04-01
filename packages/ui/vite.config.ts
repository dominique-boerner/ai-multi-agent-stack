import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    vue(),
    tailwindcss(),
  ],
  // Target esnext so esbuild 0.28+ doesn't try to downcompile Vue's
  // parameter destructuring for old browser targets (chrome87, es2020, etc.)
  build: {
    target: 'esnext',
    outDir: 'dist',
  },
  optimizeDeps: {
    esbuildOptions: {
      target: 'esnext',
    },
  },
  server: {
    port: 5173,
    proxy: {
      // Forward all API calls to the Express server during development
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      // SSE stream — needs special handling to disable buffering
      '/dashboard': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        headers: { 'Connection': 'keep-alive' },
      },
    },
  },
})
