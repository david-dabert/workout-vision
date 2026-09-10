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
  base: process.env.VITE_BASE || '/workout-vision/',
  server: {
    host: true,
    https: httpsConfig,
  },
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version || '0.0.0'),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    __FEEDBACK_URL__: JSON.stringify(process.env.VITE_FEEDBACK_URL || ''),
  },
  test: {
    exclude: ['e2e/**', 'node_modules/**'],
  },
  build: {
    target: ['es2022', 'safari16'],
    modulePreload: false,
    minify: 'esbuild',
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Only split modules that have NO circular cross-references.
          // Previous config split storage/utilities/dashboard/onboarding/analysis-engine
          // into separate chunks, but these modules import each other (e.g. storage->nutrition,
          // prSystem->storage, ResultCard->prSystem+storage) creating circular chunk warnings
          // that can cause undefined exports at runtime on some browsers.
          if (id.includes('node_modules/react-dom') || id.includes('node_modules/react/')) {
            return 'react-vendor';
          }
          if (id.includes('node_modules/localforage')) {
            return 'localforage';
          }
if (id.includes('/src/lib/exercises.js')) {
            return 'exercises';
          }
          if (id.includes('/src/lib/LanguageContext.jsx')) {
            return 'i18n';
          }
        },
      },
    },
  },
})
