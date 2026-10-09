// The crash log kept on the phone (crashLog.js; crash at the demo of 7 October): a session that did not end cleanly
// is found at the next launch, if its last breadcrumb is less than 30 minutes old.
import { beforeEach, describe, expect, it } from 'vitest';
import { detectIncident, INCIDENT_MAX_AGE_MS, startCrashLog, markCrash, noteError, pendingIncident, dismissIncident, resetCrashLogForTests } from '../crashLog';
import { crashLine } from '../../components/experience/crash-copy';

const store = () => {
  const m = new Map();
  return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), m };
};

describe('detectIncident', () => {
  const now = 1_800_000_000_000;
  it('finds a session not marked clean whose last breadcrumb is under 30 minutes old', () => {
    expect(detectIncident({ clean: false, at: now - 60_000, phase: 'extracting' }, now)).toMatchObject({ phase: 'extracting', detectedAt: now });
    expect(detectIncident({ clean: false, at: now - INCIDENT_MAX_AGE_MS + 1 }, now)).not.toBeNull();
  });
  it('ignores a clean session: a page left, hidden, or reloaded by the service worker (pagehide)', () => {
    expect(detectIncident({ clean: true, at: now - 1000 }, now)).toBeNull();
  });
  it('ignores a session 30 minutes old or more, from the future, without a time, or none', () => {
    expect(detectIncident({ clean: false, at: now - INCIDENT_MAX_AGE_MS }, now)).toBeNull();
    expect(detectIncident({ clean: false, at: now + 5000 }, now)).toBeNull();
    expect(detectIncident({ clean: false }, now)).toBeNull();
    expect(detectIncident({ at: now - 1000 }, now)).toBeNull();
    expect(detectIncident(null, now)).toBeNull();
    expect(detectIncident('garbage', now)).toBeNull();
  });
});

describe('a launch after a session that ended, cleanly or not', () => {
  let s;
  beforeEach(() => { s = store(); globalThis.localStorage = s; resetCrashLogForTests(); });
  it('names the build, the phone and the read: version, iOS, Home Screen, decoder path and source', () => {
    startCrashLog({ now: Date.now() });
    markCrash({ decoder: 'webcodecs', source: { codec: 'hvc1.2.4.L123.B0', width: 1920, height: 1080, rotation: 90, duration: 31.2 } });
    const log = JSON.parse(s.getItem('wv_crash_log'));
    expect(typeof log.version).toBe('string');
    expect(log).toHaveProperty('ios');
    expect(log).toHaveProperty('standalone');
    expect(log).toMatchObject({ decoder: 'webcodecs', source: { codec: 'hvc1.2.4.L123.B0', width: 1920, height: 1080, rotation: 90 } });
  });
  it('a session killed during the reading of the video is kept as an incident until dismissed', () => {
    startCrashLog({ now: Date.now() });
    markCrash({ screen: 'analyze', lift: 'bicep_curl', phase: 'extracting', sample: 120, frame: [360, 640] });
    noteError(new Error('Video decode failed'), 'analysis');
    // The page is killed: nothing marks it clean. Next launch:
    resetCrashLogForTests();
    startCrashLog({ now: Date.now() + 5000 });
    const incident = pendingIncident();
    expect(incident).toMatchObject({ screen: 'analyze', phase: 'extracting', sample: 120, frame: [360, 640], error: { message: 'Video decode failed', where: 'analysis' } });
    // A further launch, after a session that ended cleanly (pagehide), keeps it until dismissed.
    s.setItem('wv_crash_log', JSON.stringify({ ...JSON.parse(s.getItem('wv_crash_log')), clean: true }));
    resetCrashLogForTests();
    startCrashLog({ now: Date.now() + 10000 });
    expect(pendingIncident()).toMatchObject({ phase: 'extracting' });
    dismissIncident();
    expect(pendingIncident()).toBeNull();
  });
  it('a session whose log says clean gives no incident', () => {
    startCrashLog({ now: Date.now() });
    s.setItem('wv_crash_log', JSON.stringify({ ...JSON.parse(s.getItem('wv_crash_log')), clean: true }));
    resetCrashLogForTests();
    startCrashLog({ now: Date.now() + 5000 });
    expect(pendingIncident()).toBeNull();
  });
  it('a storage that refuses every access keeps no log and throws nothing', () => {
    globalThis.localStorage = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); }, removeItem() { throw new Error('denied'); } };
    expect(() => { startCrashLog(); markCrash({ phase: 'model' }); noteError('x'); dismissIncident(); }).not.toThrow();
    expect(pendingIncident()).toBeNull();
  });
});

describe('the note on the choice of lift', () => {
  it('says where the app was, in French and in English', () => {
    expect(crashLine({ phase: 'extracting', screen: 'analyze' }, true)).toBe('L’appli a redémarré pendant la lecture de la vidéo (analyse). Le détail est gardé sur ce téléphone.');
    expect(crashLine({ phase: 'extracting', screen: 'analyze' }, false)).toBe('The app restarted during reading the video (analysis). The details are kept on this phone.');
    expect(crashLine({ phase: null, screen: 'choice' }, true)).toBe('L’appli a redémarré (choix de l’exercice). Le détail est gardé sur ce téléphone.');
    expect(crashLine({}, false)).toBe('The app restarted. The details are kept on this phone.');
  });
});
