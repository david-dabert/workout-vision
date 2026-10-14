/**
 * A payload packed for a link: JSON in URL-safe base64. An encoding, not encryption: anyone holding the link can read
 * it. Honesty pass of 14 October 2026 (CHT-1, CHT-4): this header used to promise "serverless, zero-knowledge"
 * messaging over "encrypted URL fragment payloads and WebRTC DataChannels"; there is no WebRTC and no cryptography in
 * the app, and the chat screen is a demo that sends nothing (Chat.jsx). The invitation link (#chat=...) is gone: the
 * router sent it to the home screen. Nothing in the app calls these two functions today.
 */

/** Encodes a payload as URL-safe base64 of its JSON. */
export function encodePayload(data: unknown): string {
  try {
    const json = JSON.stringify(data);
    if (typeof btoa !== 'undefined') {
      return encodeURIComponent(btoa(unescape(encodeURIComponent(json))));
    }
    return encodeURIComponent(Buffer.from(json, 'utf-8').toString('base64'));
  } catch {
    return '';
  }
}

/** Decodes a payload made by encodePayload, or null. */
export function decodePayload<T = unknown>(encoded: string): T | null {
  try {
    const decodedUri = decodeURIComponent(encoded);
    let json: string;
    if (typeof atob !== 'undefined') {
      json = decodeURIComponent(escape(atob(decodedUri)));
    } else {
      json = Buffer.from(decodedUri, 'base64').toString('utf-8');
    }
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}
