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
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react-dom') || id.includes('node_modules/react/')) {
            return 'react-vendor';
          }
          if (id.includes('node_modules/localforage')) {
            return 'localforage';
          }
          if (id.includes('node_modules/@ffmpeg')) {
            return 'ffmpeg';
          }
          if (id.includes('/src/lib/exercises.js')) {
            return 'exercises';
          }
          if (id.includes('/src/lib/LanguageContext.jsx')) {
            return 'i18n';
          }
          if (id.includes('/src/lib/coach.js') || id.includes('/src/lib/repCounter.js') || id.includes('/src/lib/biomechanics.js') || id.includes('/src/lib/exerciseDetector.js')) {
            return 'analysis-engine';
          }
          if (id.includes('/src/lib/shareCard.js') || id.includes('/src/lib/nutrition.js') || id.includes('/src/lib/prSystem.js') || id.includes('/src/lib/injuryRisk.js')) {
            return 'utilities';
          }
          if (id.includes('/src/components/Dashboard.jsx') || id.includes('/src/components/MuscleMap.jsx') || id.includes('/src/components/VisionScoreHero.jsx') || id.includes('/src/components/ChallengeBar.jsx') || id.includes('/src/components/InjuryRiskCard.jsx')) {
            return 'dashboard';
          }
          if (id.includes('/src/components/Onboarding.jsx') || id.includes('/src/components/ResultCard.jsx')) {
            return 'onboarding';
          }
          if (id.includes('/src/components/VideoUpload.jsx') || id.includes('/src/components/VideoReplay.jsx')) {
            return 'video';
          }
          if (id.includes('/src/lib/storage.js') || id.includes('/src/lib/dataPortability.js')) {
            return 'storage';
          }
        },
      },
    },
  },
})
