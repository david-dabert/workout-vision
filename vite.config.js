import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { resolve } from 'path'

const certDir = path.resolve(__dirname, '.certs')
const httpsConfig = fs.existsSync(path.join(certDir, 'key.pem'))
  ? { key: fs.readFileSync(path.join(certDir, 'key.pem')), cert: fs.readFileSync(path.join(certDir, 'cert.pem')) }
  : undefined

/** Vite plugin: copy MediaPipe WASM files to public/ before build */
function copyModelsPlugin() {
  return {
    name: 'copy-models',
    buildStart() {
      execSync('node scripts/copy-models.js', { stdio: 'inherit', cwd: __dirname })
    },
  }
}

/**
 * Vite plugin: the pages' Content-Security-Policy lets them reach the server of the anonymous usage counts, and no
 * other, when the build names one (VITE_EVENTS_URL, src/lib/events.js). Without it the policy is left as written.
 * The value must be an https URL (http only for localhost); anything else fails the build rather than widen the policy.
 */
export function eventsCspPlugin(fixed) {
  let origin = '';
  return {
    name: 'events-csp',
    // The value the app reads (import.meta.env), from the environment or a .env file.
    configResolved(config) { origin = eventsOrigin(fixed ?? config.env.VITE_EVENTS_URL ?? ''); },
    transformIndexHtml(html) {
      if (!origin) return html;
      return html.replace(/(connect-src [^;"]*)/, `$1 ${origin}`);
    },
  };
}

/** The origin of the events URL, or '' when none is set. Throws on a URL that is not https (http only for localhost). */
export function eventsOrigin(url) {
  if (!url) return '';
  let u;
  try { u = new URL(url); } catch { throw new Error(`VITE_EVENTS_URL is not a URL: ${url}`); }
  const local = u.hostname === 'localhost' || u.hostname === '127.0.0.1';
  if (!(u.protocol === 'https:' || (u.protocol === 'http:' && local))) throw new Error(`VITE_EVENTS_URL must be https: ${url}`);
  return u.origin;
}

export default defineConfig({
  plugins: [react(), copyModelsPlugin(), eventsCspPlugin()],
  base: process.env.VITE_BASE || '/workout-vision/',
  server: {
    host: true,
    https: httpsConfig,
    // Agent worktrees (.claude/worktrees, tens of thousands of files) and the stored datasets are never served
    // code: watching them exhausted the system's file watchers and stopped the dev server (4 October).
    watch: { ignored: ['**/.claude/**', '**/test/real-phone/public/**', '**/dist*/**'] },
  },
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version || '0.0.0'),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    __FEEDBACK_URL__: JSON.stringify(process.env.VITE_FEEDBACK_URL || ''),
    __GIT_HASH__: JSON.stringify((() => { try { return execSync('git rev-parse --short HEAD').toString().trim(); } catch { return 'dev'; } })()),
  },
  test: {
    // Agents' worktrees (.claude/) hold other checkouts: a local run tests this one only, as CI does (audit of 3 October).
    exclude: ['e2e/**', 'node_modules/**', '.claude/**', '.git/**'],
  },
  build: {
    assetsInlineLimit: 0, // Fonts remain same-origin files under font-src 'self'.
    target: ['es2022', 'safari16'],
    modulePreload: false,
    minify: 'esbuild',
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'index.html'),
        collect: resolve(__dirname, 'collect.html'),
        collectBatch: resolve(__dirname, 'collect-batch.html'),
        check: resolve(__dirname, 'check.html'),
      },
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
