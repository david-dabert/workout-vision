import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { resolve } from 'path'
import { uploadAllowed } from './src/lib/kine/attemptStorage.js'

// npm run dev:lan: the dev server on the local network, with the stricter file list below.
const LAN = process.env.WV_LAN === '1'

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

/**
 * Vite plugin: the pages' Content-Security-Policy lets them load the physiotherapist's reference videos, posters and
 * poses from the media address the build names (VITE_KINE_MEDIA_URL, src/lib/kine/library.js), and no other. Without
 * it the policy is left as written. https only (http for localhost); anything else fails the build.
 */
export function kineMediaCspPlugin(fixed) {
  let origin = '';
  return {
    name: 'kine-media-csp',
    configResolved(config) { origin = kineMediaOrigin(fixed ?? config.env.VITE_KINE_MEDIA_URL ?? ''); },
    transformIndexHtml(html) {
      if (!origin) return html;
      return html
        .replace(/(connect-src [^;"]*)/, `$1 ${origin}`)
        .replace(/(media-src [^;"]*)/, `$1 ${origin}`)
        .replace(/(img-src [^;"]*)/, `$1 ${origin}`);
    },
  };
}

/** The origin of the media address, or '' when none is set. Throws on a URL that is not https (http only locally). */
export function kineMediaOrigin(url) {
  if (!url) return '';
  let u;
  try { u = new URL(url); } catch { throw new Error(`VITE_KINE_MEDIA_URL is not a URL: ${url}`); }
  const local = u.hostname === 'localhost' || u.hostname === '127.0.0.1';
  if (!(u.protocol === 'https:' || (u.protocol === 'http:' && local))) throw new Error(`VITE_KINE_MEDIA_URL must be https: ${url}`);
  return u.origin;
}

/**
 * Vite plugin: the pages' Content-Security-Policy lets them reach the proxy of the AI commentary and Vercel Blob's
 * upload address, when the build names the proxy (VITE_GLIMPSE_URL, src/lib/kine/glimpse.js), and no other. Without it
 * the policy is left as written and the commentary is not offered. https only (http for localhost).
 * A production build offers no upload while the attempt store is public (src/lib/kine/attemptStorage.js; David,
 * 24 October 2026), so its policy reaches neither the proxy nor Vercel Blob; the address is still checked.
 */
export function glimpseCspPlugin(fixed) {
  let origin = '';
  return {
    name: 'glimpse-csp',
    configResolved(config) {
      const named = glimpseOrigin(fixed ?? config.env.VITE_GLIMPSE_URL ?? '');
      origin = uploadAllowed(config.isProduction) ? named : '';
    },
    transformIndexHtml(html) {
      if (!origin) return html;
      return html.replace(/(connect-src [^;"]*)/, `$1 ${origin} ${BLOB_UPLOAD_ORIGIN}`);
    },
  };
}

// Where @vercel/blob/client puts a file (its API, vercel.com/api/blob).
export const BLOB_UPLOAD_ORIGIN = 'https://vercel.com';

/** The origin of the proxy's address, or '' when none is set. Throws on a URL that is not https (http only locally). */
export function glimpseOrigin(url) {
  if (!url) return '';
  let u;
  try { u = new URL(url); } catch { throw new Error(`VITE_GLIMPSE_URL is not a URL: ${url}`); }
  const local = u.hostname === 'localhost' || u.hostname === '127.0.0.1';
  if (!(u.protocol === 'https:' || (u.protocol === 'http:' && local))) throw new Error(`VITE_GLIMPSE_URL must be https: ${url}`);
  return u.origin;
}

export default defineConfig({
  // The analysed demo videos ship again since 14 October 2026 (David): shown as previews of where the app is going,
  // labelled « Aperçu », never as measured (SportsBiomechanics.jsx, Equine.jsx). scripts/omit-painted-demos.js still
  // names them (isPaintedDemo) for tests.
  plugins: [react(), copyModelsPlugin(), eventsCspPlugin(), kineMediaCspPlugin(), glimpseCspPlugin()],
  // jsPDF's optional modules, used only by doc.html() and addSvgAsImage(), which the app never calls: stubbed
  // (src/lib/jspdf-optional-stub.js, C9 of the design review of 7 October 2026).
  resolve: {
    alias: Object.fromEntries(['html2canvas', 'canvg', 'dompurify'].map(m => [m, resolve(__dirname, 'src/lib/jspdf-optional-stub.js')])),
  },
  base: process.env.VERCEL ? '/' : (process.env.VITE_BASE || '/workout-vision/'),
  server: {
    // This computer only. npm run dev:lan (WV_LAN=1) serves the network too, for a phone on the same Wi-Fi
    // (audit of 6 October, action 18).
    host: LAN ? true : '127.0.0.1',
    https: httpsConfig,
    // Vite's own denials always. On the network, also the labelled sets and their landmarks (test/), the benchmark
    // data and any video: anyone on the Wi-Fi could otherwise fetch them. On this computer they stay served, since
    // the decoding harness (test/real-phone/harness.html, e2e/decode-clips.spec.js) loads David's clips through the
    // dev server. A bare vite --host bypasses the network list: use npm run dev:lan.
    fs: { deny: ['.env', '.env.*', '*.{crt,pem}', '**/.git/**', ...(LAN ? ['**/test/**', '**/benchmark/**', '**/*.{mp4,MP4,mov,MOV,m4v,M4V,webm,avi,mkv}'] : [])] },
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
        pack: resolve(__dirname, 'pack.html'),
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
