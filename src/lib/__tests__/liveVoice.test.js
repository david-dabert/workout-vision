// The spoken count uses only a voice that runs on the phone (liveVoice.js): a voice synthesised on a server would
// send the number off the phone. And the camera helpers name each failure the screen words (liveCamera.js).
import { describe, it, expect, vi } from 'vitest';
import { localVoice, canSpeak, say, buzz, voiceWanted, setVoiceWanted } from '../liveVoice';
import { cameraProblem, canOpenCamera, openCamera } from '../liveCamera';
import { sampleSize, SAMPLE_MS, MAX_BACKLOG } from '../liveEngine';

const synth = voices => ({ getVoices: () => voices, speak: vi.fn(), cancel: vi.fn() });

describe('the spoken count', () => {
  it('never picks a voice made on a server', () => {
    const remote = { lang: 'fr-FR', localService: false, default: true, name: 'Google français' };
    expect(localVoice('fr', synth([remote]))).toBeNull();
    expect(canSpeak('fr', synth([remote]))).toBe(false);
    const s = synth([remote]);
    expect(say('3', 'fr', s)).toBe(false);
    expect(s.speak).not.toHaveBeenCalled();
  });
  it('picks the phone\'s own voice in the app\'s language', () => {
    const en = { lang: 'en-US', localService: true, default: true, name: 'Samantha' };
    const fr = { lang: 'fr_FR', localService: true, default: false, name: 'Thomas' };
    expect(localVoice('fr', synth([en, fr]))).toBe(fr);
    expect(localVoice('en', synth([en, fr]))).toBe(en);
    expect(localVoice('fr', synth([en]))).toBeNull();
    expect(localVoice('fr', undefined)).toBeNull();
  });
  it('buzzes only where the phone can', () => {
    const vibrate = vi.fn();
    buzz(40, { vibrate });
    expect(vibrate).toHaveBeenCalledWith(40);
    expect(() => buzz(40, {})).not.toThrow();
  });
  it('is on unless turned off', () => {
    const store = new Map();
    vi.stubGlobal('localStorage', { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, v), removeItem: k => store.delete(k) });
    expect(voiceWanted()).toBe(true);
    setVoiceWanted(false);
    expect(voiceWanted()).toBe(false);
    setVoiceWanted(true);
    expect(voiceWanted()).toBe(true);
    vi.unstubAllGlobals();
  });
});

describe('the live camera', () => {
  it('names each failure', () => {
    expect(cameraProblem({ name: 'NotAllowedError' })).toBe('denied');
    expect(cameraProblem({ name: 'SecurityError' })).toBe('denied');
    expect(cameraProblem({ name: 'NotFoundError' })).toBe('nocamera');
    expect(cameraProblem({ name: 'OverconstrainedError' })).toBe('nocamera');
    expect(cameraProblem({ name: 'NotReadableError' })).toBe('busy');
    expect(cameraProblem({ name: 'NotSupportedError' })).toBe('unsupported');
  });
  it('asks for video only, the rear camera first', async () => {
    const getUserMedia = vi.fn(async c => c);
    const nav = { mediaDevices: { getUserMedia } };
    expect(canOpenCamera(nav)).toBe(true);
    const asked = await openCamera(undefined, nav);
    expect(asked.audio).toBe(false);
    expect(asked.video.facingMode).toEqual({ ideal: 'environment' });
    await expect(openCamera('user', {})).rejects.toMatchObject({ name: 'NotSupportedError' });
  });
  it('samples at the core\'s rate and size', () => {
    expect(SAMPLE_MS).toBeCloseTo(1000 / 15, 6);
    expect(MAX_BACKLOG).toBe(30);
    // As frameExtractor.js scales a decoded frame: 640 on the long side, never enlarged.
    expect(sampleSize(1280, 720)).toEqual([640, 360]);
    expect(sampleSize(720, 1280)).toEqual([360, 640]);
    expect(sampleSize(640, 480)).toEqual([640, 480]);
    expect(sampleSize(320, 240)).toEqual([320, 240]);
    expect(sampleSize(1920, 1081)).toEqual([640, 360]);
  });
});
