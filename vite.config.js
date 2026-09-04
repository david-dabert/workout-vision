import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'

const certDir = path.resolve(__dirname, '.certs')
const httpsConfig = fs.existsSync(path.join(certDir, 'key.pem'))
  ? { key: fs.readFileSync(path.join(certDir, 'key.pem')), cert: fs.readFileSync(path.join(certDir, 'cert.pem')) }
  : undefined

/** Vite plugin: copy MediaPipe WASM files to public/ before build */
function copyModelsPlugin() {
  return {
    name: 'copy-models',
    buildStart() {
      try {
        execSync('node scripts/copy-models.js', { stdio: 'inherit', cwd: __dirname })
      } catch (e) {
        console.warn('[copy-models plugin] Warning:', e.message)
      }
    },
  }
}

export default defineConfig({
  plugins: [react(), copyModelsPlugin()],
  base: '/workout-vision/',
  server: {
    host: true,
    https: httpsConfig,
  },
  build: {
    target: ['es2022', 'safari16'],
    modulePreload: false,
    minify: 'esbuild',
  },
})
