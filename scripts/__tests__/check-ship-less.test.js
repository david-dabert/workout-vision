// Card 049: the check that the production build ships only what its pages use.
import { describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { shippedOff } from '../check-ship-less.mjs';

function dist(files) {
  const dir = mkdtempSync(join(tmpdir(), 'ship-less-'));
  mkdirSync(join(dir, 'assets'));
  for (const [name, text] of Object.entries(files)) {
    const fullPath = join(dir, name);
    mkdirSync(dirname(fullPath), { recursive: true });
    writeFileSync(fullPath, text);
  }
  return dir;
}

describe('check-ship-less', () => {
  it('passes a build that ships only production code', async () => {
    const dir = dist({ 'index.html': `<meta content="connect-src 'self' blob:; img-src 'self'">`, 'assets/index-AbCdEf12.js': 'x', 'assets/Pro-AbCdEf12.js': 'y' });
    expect(await shippedOff(dir)).toEqual([]);
  });

  it('names an extended chunk, the Blob client and a lookup origin', async () => {
    const dir = dist({
      'index.html': `<meta content="connect-src 'self' blob: https://world.openfoodfacts.org; img-src 'self'">`,
      'assets/Equine-AbCdEf12.js': 'x',
      'assets/CoachSuite-Ab_d-f12.css': 'x',
      'assets/client-AbCdEf12.js': 'fetch(handleUploadUrl)',
    });
    const kinds = (await shippedOff(dir)).map(x => `${x.kind}: ${x.what}`).sort();
    expect(kinds).toEqual([
      'Blob upload client: assets/client-AbCdEf12.js',
      'connect-src lookup: index.html: world.openfoodfacts.org',
      'extended chunk: assets/CoachSuite-Ab_d-f12.css',
      'extended chunk: assets/Equine-AbCdEf12.js',
    ]);
  });

  it('names an unused MediaPipe module asset', async () => {
    const dir = dist({
      'index.html': `<meta content="connect-src 'self' blob:; img-src 'self'">`,
      'mediapipe/vision_wasm_module_internal.wasm': 'x',
    });
    expect(await shippedOff(dir)).toEqual([
      { kind: 'unused MediaPipe module asset', what: 'mediapipe/vision_wasm_module_internal.wasm' },
    ]);
  });
});
