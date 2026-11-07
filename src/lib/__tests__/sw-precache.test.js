/**
 * Tests for the service worker precache budget and rules (Phase 5 of David's order of 6 November 2026, PLAN.md).
 * Checks that the precache asset list only contains the core shell, Latin fonts, and boot fallbacks,
 * never containing MediaPipe models, WASM files, or unneeded deferred screens.
 */
import { describe, expect, it } from 'vitest';
import { check, staticImports } from '../../../scripts/check-entry-budget.mjs';

describe('check-entry-budget rules', () => {
  it('extracts static imports correctly', () => {
    const code = `
      import { foo } from "./foo.js";
      import "./bar.js";
      export * from './baz.js';
      const dynamic = import('./ignored.js');
    `;
    const imports = staticImports(code);
    expect(imports).toContain('./foo.js');
    expect(imports).toContain('./bar.js');
    expect(imports).toContain('./baz.js');
    expect(imports).not.toContain('./ignored.js');
  });

  it('flags entries over the 150 kB gzipped budget', () => {
    const mockBuild = {
      chunks: [{ file: 'dist/assets/index.js', bytes: 600000, gzip: 160000 }],
      sheets: [{ file: 'dist/assets/index.css', attrs: { href: '/assets/index.css' } }],
      preloads: [],
      boot: null,
      precache: null,
      head: '',
    };
    const errors = check(mockBuild);
    expect(errors.some(e => e.includes('over 150000'))).toBe(true);
  });

  it('rejects pose files or deferred screens in the SW precache list', () => {
    const mockBuild = {
      chunks: [{ file: 'dist/assets/index.js', bytes: 50000, gzip: 20000 }],
      sheets: [{ file: 'dist/assets/index.css', attrs: { href: '/assets/index.css' } }],
      preloads: [
        { file: 'dist/assets/geist-latin-700-normal-12345678.woff2', attrs: { href: '/assets/geist-latin-700-normal-12345678.woff2', crossorigin: '' } },
        { file: 'dist/assets/instrument-serif-latin-400-italic-12345678.woff2', attrs: { href: '/assets/instrument-serif-latin-400-italic-12345678.woff2', crossorigin: '' } }
      ],
      boot: { at: 10, attrs: {} },
      head: '<script src="/boot.js"></script>',
      precache: [
        '/workout-vision/assets/index.js',
        '/workout-vision/mediapipe/pose_landmarker_full.task',
        '/workout-vision/assets/About-12345678.js',
      ],
      fileOf: href => `dist${href.replace('/workout-vision', '')}`,
    };
    const errors = check(mockBuild);
    expect(errors.some(e => e.includes('the install list holds a pose file'))).toBe(true);
    expect(errors.some(e => e.includes('the install list holds a file outside the shell'))).toBe(true);
  });
});
