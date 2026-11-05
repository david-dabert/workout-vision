/**
 * Sovereign Audio Voice Notes Engine
 *
 * Implements client-side voice memo recording, playback, and export for personal trainers:
 * Rather than paying $29–$79/month for SaaS backends (like Ekklo) to host audio notes on
 * AWS S3 or Google Cloud, this module records audio directly via the browser's MediaRecorder API,
 * compresses it using native Opus / AAC codecs, and persists it on-device in IndexedDB.
 *
 * Voice notes can be played back natively or exported via the Web Share API (WhatsApp/iMessage/email)
 * at $0.00 backend cost with 100% athlete privacy.
 */

import localforage from 'localforage';

export interface VoiceNote {
  id: string;
  clientId: string;
  sessionId?: string;
  createdAt: number;
  durationSec: number;
  mimeType: string;
  audioBlob: Blob;
}

const voiceNoteStore = localforage.createInstance({
  name: 'workoutVision',
  storeName: 'coachVoiceNotes',
});

const CANDIDATE_MIME_TYPES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4',
  'audio/ogg;codecs=opus',
  'audio/aac',
];

/**
 * Returns the best supported audio MIME type for MediaRecorder on this device/browser.
 * Returns null if MediaRecorder is not supported.
 */
export function getSupportedAudioMimeType(): string | null {
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') {
    return null;
  }
  for (const type of CANDIDATE_MIME_TYPES) {
    if (MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }
  return '';
}

/**
 * Persists an audio voice note to IndexedDB.
 */
export async function saveVoiceNote(note: Omit<VoiceNote, 'id' | 'createdAt'> & { id?: string; createdAt?: number }): Promise<VoiceNote> {
  const finalNote: VoiceNote = {
    ...note,
    id: note.id || `vn_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: note.createdAt || Date.now(),
  };

  await voiceNoteStore.setItem(finalNote.id, finalNote);
  return finalNote;
}

/**
 * Retrieves all voice notes associated with a given client ID, sorted newest first.
 */
export async function getVoiceNotesForClient(clientId: string): Promise<VoiceNote[]> {
  const notes: VoiceNote[] = [];
  await voiceNoteStore.iterate<VoiceNote, void>((value) => {
    if (value && value.clientId === clientId) {
      notes.push(value);
    }
  });
  return notes.sort((a, b) => b.createdAt - a.createdAt);
}

/**
 * Retrieves a single voice note by its ID.
 */
export async function getVoiceNote(id: string): Promise<VoiceNote | null> {
  return voiceNoteStore.getItem<VoiceNote>(id);
}

/**
 * Deletes a voice note from IndexedDB.
 */
export async function deleteVoiceNote(id: string): Promise<void> {
  await voiceNoteStore.removeItem(id);
}

/**
 * Prepares a voice note as a File for native sharing or download.
 */
export function voiceNoteToFile(note: VoiceNote, clientName = 'client'): File | null {
  if (typeof File === 'undefined') return null;
  const ext = note.mimeType.includes('mp4') ? 'm4a' : note.mimeType.includes('ogg') ? 'ogg' : 'webm';
  const dateStr = new Date(note.createdAt).toISOString().slice(0, 10);
  const fileName = `workoutvision-feedback-${clientName.toLowerCase().replace(/\s+/g, '-')}-${dateStr}.${ext}`;
  return new File([note.audioBlob], fileName, { type: note.mimeType });
}
