// Draws the app's icons with the app's own particle renderer (src/components/experience/entry-scene.js)
// and the entry screen's pose, in the app's gold on its black, so the home screen shows the figure
// the visitor meets on opening. Deterministic: the particles come from a seeded generator and the
// time is fixed. Run with: node scripts/make-icons.mjs (Chromium from Playwright; PW_CHROMIUM may
// name its executable, as in the e2e tests). Writes public/icon-192.png, icon-512.png,
// icon-192-maskable.png, icon-512-maskable.png, apple-touch-icon.png and favicon.svg.
import { readFileSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';
import sharp from 'sharp';

const root = new URL('../', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8');
const scene = read('src/components/experience/entry-scene.js')
  .replace("import entry from './entry-pose.json';", `const entry = ${read('src/components/experience/entry-pose.json')};`);
if (scene.includes('entry-pose.json')) throw new Error('entry-scene.js no longer imports its pose as expected');

const draw = `
window.__drawIcon = (kind, S) => {
  const c = document.createElement('canvas'); c.width = c.height = S;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#080706'; ctx.fillRect(0, 0, S, S);
  const g = ctx.createRadialGradient(S / 2, S * 0.42, 0, S / 2, S * 0.42, S * 0.62);
  g.addColorStop(0, 'rgba(232,189,126,0.16)'); g.addColorStop(0.55, 'rgba(232,189,126,0.04)'); g.addColorStop(1, 'rgba(232,189,126,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
  // Maskable icons keep the figure inside the central circle of 80 % that every launcher mask keeps.
  const rect = kind === 'maskable' ? { x: S * 0.29, y: S * 0.23, w: S * 0.42, h: S * 0.54 } : { x: S * 0.2, y: S * 0.14, w: S * 0.6, h: S * 0.72 };
  const body = new Body(1600, 7), out = new Float32Array(66);
  mapPose(new Float32Array(entry.p), entry.vb, rect, out);
  body.draw(ctx, out, { alpha: 0.8, time: 1.5, dpr: (S / 180) * 0.45, stars: 1 });
  return c.toDataURL('image/png');
};`;

const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
const page = await browser.newPage();
await page.setContent('<!doctype html><html><body></body></html>');
await page.addScriptTag({ type: 'module', content: scene + draw });
await page.waitForFunction(() => typeof window.__drawIcon === 'function');
const render = async kind => Buffer.from((await page.evaluate(k => window.__drawIcon(k, 1024), kind)).split(',')[1], 'base64');
const full = await render('full'), maskable = await render('maskable');
await browser.close();

const png = (buffer, size) => sharp(buffer).resize(size, size, { kernel: 'lanczos3' }).png({ compressionLevel: 9 }).toBuffer();
const out = path => new URL(`public/${path}`, root);
writeFileSync(out('icon-512.png'), await png(full, 512));
writeFileSync(out('icon-192.png'), await png(full, 192));
writeFileSync(out('apple-touch-icon.png'), await png(full, 180));
writeFileSync(out('icon-512-maskable.png'), await png(maskable, 512));
writeFileSync(out('icon-192-maskable.png'), await png(maskable, 192));
const small = (await png(full, 64)).toString('base64');
writeFileSync(out('favicon.svg'), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><image width="64" height="64" href="data:image/png;base64,${small}"/></svg>\n`);
console.log('icons written to public/');
