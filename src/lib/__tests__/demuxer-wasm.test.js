// public/web-demuxer.wasm is a copy of the web-demuxer package's own file, loaded beside the package's JavaScript
// (frameExtractor.js). An upgrade of the package without a new copy would pair new JavaScript with old WASM
// (audit of 3 October): the copy must stay byte for byte the package's.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';

const sha = p => createHash('sha256').update(readFileSync(resolve(__dirname, '../../..', p))).digest('hex');
describe('the demuxer WASM', () => {
  it('is the installed package\'s own file', () => {
    expect(sha('public/web-demuxer.wasm')).toBe(sha('node_modules/web-demuxer/dist/wasm-files/web-demuxer.wasm'));
  });
});
