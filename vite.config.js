import { defineConfig } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] })
  ],
  server: {
    proxy: {
      '/api/bgr': {
        target: 'https://services.bgr.de',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/bgr/, ''),
      },
      '/api/flask': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/flask/, ''),
      },
    },
  },
})
