import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/workout-vision/',
  build: {
    target: ['es2020', 'safari14'],
    modulePreload: false,
    minify: 'esbuild',
  },
})
