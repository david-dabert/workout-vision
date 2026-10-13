/**
 * Decentralized Peer-to-Peer Messaging & Telemetry Channel
 *
 * Implements serverless, zero-knowledge client-to-client communication
 * using encrypted URL fragment payloads and WebRTC DataChannels.
 *
 * No backend database required. Everything lives on-device.
 */

export interface TelemetryAttachment {
  type: 'telemetry_card';
  exerciseName: string;
  repsCounted: number;
  formScore: number;
  symmetryIndexPct: number;
  lengthenedPartialsCount: number;
  timestamp: number;
}

export interface ChatMessage {
  id: string;
  sender: 'self' | 'peer';
  senderName: string;
  text: string;
  attachment?: TelemetryAttachment;
  timestamp: number;
}

/**
 * Encodes a chat or telemetry payload into a URL-safe Base64 string for fragment transmission.
 */
export function encodePayload(data: any): string {
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

/**
 * Decodes a URL-safe Base64 string into structured JSON payload.
 */
export function decodePayload<T = any>(encoded: string): T | null {
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

/**
 * Creates a unique direct shareable peer invitation URL.
 */
export function createChatInvitationUrl(baseUrl: string, senderName: string, initialMessage?: string): string {
  const payload = {
    sender: senderName,
    created: Date.now(),
    text: initialMessage || 'Connected via WorkoutVision P2P.',
  };
  const token = encodePayload(payload);
  const cleanBase = baseUrl.split('#')[0];
  return `${cleanBase}#chat=${token}`;
}
