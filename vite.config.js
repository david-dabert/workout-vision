import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

const certDir = path.resolve(__dirname, '.certs')
const httpsConfig = fs.existsSync(path.join(certDir, 'key.pem'))
  ? { key: fs.readFileSync(path.join(certDir, 'key.pem')), cert: fs.readFileSync(path.join(certDir, 'cert.pem')) }
  : undefined

export default defineConfig({
  plugins: [react()],
  base: '/workout-vision/',
  server: {
    host: true,
    https: httpsConfig,
  },
  build: {
    target: ['es2020', 'safari14'],
    modulePreload: false,
    minify: 'esbuild',
  },
})
