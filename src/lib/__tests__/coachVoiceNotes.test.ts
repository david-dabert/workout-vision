import { describe, it, expect, vi, beforeEach } from 'vitest';

// In-memory localforage mock using vi.hoisted
const stores = vi.hoisted(() => new Map<string, Map<string, unknown>>());
vi.mock('localforage', () => ({
  default: {
    createInstance: ({ storeName }: { storeName: string }) => {
      if (!stores.has(storeName)) stores.set(storeName, new Map());
      const m = stores.get(storeName)!;
      return {
        getItem: async (k: string) => (m.has(k) ? structuredClone(m.get(k)) : null),
        setItem: async (k: string, v: unknown) => { m.set(k, structuredClone(v)); return v; },
        removeItem: async (k: string) => { m.delete(k); },
        iterate: async (fn: (val: unknown, key: string) => void) => {
          for (const [k, v] of m) fn(structuredClone(v), k);
        },
      };
    },
  },
}));

import {
  getSupportedAudioMimeType,
  saveVoiceNote,
  getVoiceNotesForClient,
  getVoiceNote,
  deleteVoiceNote,
  voiceNoteToFile,
  VoiceNote,
} from '../coachVoiceNotes';

describe('Sovereign Coach Voice Notes Engine', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    for (const m of stores.values()) m.clear();
  });

  describe('getSupportedAudioMimeType', () => {
    it('returns null when MediaRecorder is undefined', () => {
      vi.stubGlobal('MediaRecorder', undefined);
      expect(getSupportedAudioMimeType()).toBeNull();
    });

    it('returns the first supported candidate MIME type', () => {
      vi.stubGlobal('MediaRecorder', {
        isTypeSupported: (type: string) => type === 'audio/webm;codecs=opus',
      });
      expect(getSupportedAudioMimeType()).toBe('audio/webm;codecs=opus');
    });

    it('returns audio/mp4 if webm is not supported (e.g. Safari WebKit)', () => {
      vi.stubGlobal('MediaRecorder', {
        isTypeSupported: (type: string) => type === 'audio/mp4',
      });
      expect(getSupportedAudioMimeType()).toBe('audio/mp4');
    });
  });

  describe('Storage CRUD operations', () => {
    it('saves a voice note, generates an ID and timestamp, and retrieves it', async () => {
      const mockBlob = new Blob(['mock audio data'], { type: 'audio/webm' });
      const saved = await saveVoiceNote({
        clientId: 'client_123',
        sessionId: 'sess_456',
        durationSec: 15,
        mimeType: 'audio/webm',
        audioBlob: mockBlob,
      });

      expect(saved.id).toMatch(/^vn_\d+_/);
      expect(saved.createdAt).toBeGreaterThan(0);
      expect(saved.durationSec).toBe(15);

      const retrieved = await getVoiceNote(saved.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe(saved.id);
      expect(retrieved?.clientId).toBe('client_123');

      const clientNotes = await getVoiceNotesForClient('client_123');
      expect(clientNotes.some(n => n.id === saved.id)).toBe(true);

      await deleteVoiceNote(saved.id);
      const afterDelete = await getVoiceNote(saved.id);
      expect(afterDelete).toBeNull();
    });
  });

  describe('voiceNoteToFile', () => {
    it('formats file with correct extension and name', () => {
      const mockBlob = new Blob(['audio bytes'], { type: 'audio/mp4' });
      const note: VoiceNote = {
        id: 'vn_1',
        clientId: 'client_789',
        createdAt: new Date('2026-10-15T12:00:00Z').getTime(),
        durationSec: 25,
        mimeType: 'audio/mp4',
        audioBlob: mockBlob,
      };

      const file = voiceNoteToFile(note, 'Camille Martin');
      expect(file).not.toBeNull();
      expect(file?.name).toBe('workoutvision-feedback-camille-martin-2026-10-15.m4a');
      expect(file?.type).toBe('audio/mp4');
    });

    it('handles webm extension default', () => {
      const mockBlob = new Blob(['audio bytes'], { type: 'audio/webm' });
      const note: VoiceNote = {
        id: 'vn_2',
        clientId: 'client_789',
        createdAt: new Date('2026-10-15T12:00:00Z').getTime(),
        durationSec: 10,
        mimeType: 'audio/webm',
        audioBlob: mockBlob,
      };

      const file = voiceNoteToFile(note, 'Alex');
      expect(file).not.toBeNull();
      expect(file?.name).toBe('workoutvision-feedback-alex-2026-10-15.webm');
      expect(file?.type).toBe('audio/webm');
    });
  });
});
