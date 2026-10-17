/**
 * The pose model the analysis loads is the one the app was built with (audit FINDING-018): its copy kept in
 * IndexedDB was taken on size alone, so corrupt or foreign bytes over 5 MB were handed to the model loader on every
 * visit. The fingerprint is one, shared with the build's check (scripts/copy-models.js) and the service worker.
 */
import { describe, expect, it } from 'vitest';
import { createHash, webcrypto } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { HEAVY_MODEL_SHA256, MODEL_SHA256, isTheHeavyModel, isTheModel } from '../model-hash';

describe('the pose model', () => {
  if (!globalThis.crypto?.subtle) globalThis.crypto = webcrypto;
  it('the bundled file has the shared fingerprint', () => {
    const bytes = readFileSync(resolve(__dirname, '../../../public/mediapipe/pose_landmarker_full.task'));
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(MODEL_SHA256);
  });
  it('is recognised, and other bytes of the same size are not', async () => {
    const bytes = readFileSync(resolve(__dirname, '../../../public/mediapipe/pose_landmarker_full.task'));
    const buf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    expect(await isTheModel(buf)).toBe(true);
    const other = new Uint8Array(buf.byteLength); other[0] = 1;
    expect(await isTheModel(other.buffer)).toBe(false);
  });
  it('the build script checks the same fingerprint', () => {
    expect(readFileSync(resolve(__dirname, '../../../scripts/copy-models.js'), 'utf8')).toContain('model-hash.json');
  });
  it('the heavy model (the deeper analysis\'s) has its own fingerprint, checked at build', async () => {
    const bytes = readFileSync(resolve(__dirname, '../../../public/mediapipe/pose_landmarker_heavy.task'));
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(HEAVY_MODEL_SHA256);
    const buf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    expect(await isTheHeavyModel(buf)).toBe(true);
    expect(await isTheModel(buf)).toBe(false);
    expect(readFileSync(resolve(__dirname, '../../../scripts/copy-models.js'), 'utf8')).toContain('heavySha256');
  });
});
