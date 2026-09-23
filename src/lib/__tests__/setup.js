/**
 * Vitest setup file: initializes EXERCISES before tests run.
 * Mocks fetch to serve exercises.json from the filesystem.
 */
import { vi, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { initExercises } from '../exercises';

// Mock fetch to serve exercises.json from public/data/
const exercisesJson = readFileSync(
  resolve(__dirname, '../../../public/data/exercises.json'),
  'utf-8'
);

const originalFetch = globalThis.fetch;

beforeAll(async () => {
  // Install mock fetch before initExercises
  globalThis.fetch = vi.fn((url) => {
    if (typeof url === 'string' && url.includes('exercises.json')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(JSON.parse(exercisesJson)),
      });
    }
    // Fall through to original fetch for other URLs
    if (originalFetch) return originalFetch(url);
    return Promise.reject(new Error(`Unmocked fetch: ${url}`));
  });

  await initExercises();
});
