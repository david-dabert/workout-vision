/**
 * Lightweight, privacy-first telemetry.
 * All data stays on-device (localStorage). No external calls.
 * Tracks performance metrics and usage patterns for debugging.
 */

import type { TelemetryEvent } from './types';

const STORAGE_KEY = 'wv_telemetry';
const MAX_EVENTS = 200;

let sessionStart = Date.now();
let sessionId = Math.random().toString(36).slice(2, 10);

function getEvents(): TelemetryEvent[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') as TelemetryEvent[];
  } catch {
    return [];
  }
}

function persistEvents(events: TelemetryEvent[]): void {
  try {
    // Keep only most recent events
    const trimmed = events.slice(-MAX_EVENTS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch { /* quota exceeded — silently drop */ }
}

/**
 * Log a telemetry event.
 * @param name - Event name (e.g., 'analysis_complete', 'worker_init')
 * @param data - Event payload
 */
export function trackEvent(name: string, data: Record<string, unknown> = {}): void {
  const event: TelemetryEvent = {
    name,
    ts: Date.now(),
    sid: sessionId,
    ...data,
  };

  if (import.meta.env.DEV) {
    console.debug('[telemetry]', name, data);
  }

  const events = getEvents();
  events.push(event);
  persistEvents(events);
}

/**
 * Track a performance timing.
 * Returns a stop function that logs the duration.
 * @param name - Metric name
 * @param meta - Additional metadata
 * @returns stop function that returns duration in ms
 */
export function trackTiming(name: string, meta: Record<string, unknown> = {}): () => number {
  const start = performance.now();
  return () => {
    const duration = Math.round(performance.now() - start);
    trackEvent(`timing_${name}`, { duration, ...meta });
    return duration;
  };
}

interface AnalysisResult {
  exercise?: string;
  reps?: number;
  formScore?: number | null;
  duration?: number;
  analysisTime?: number;
  fps?: number;
  confidence?: { totalFrames?: number; level?: string };
  autoDetected?: boolean;
  aborted?: boolean;
  debug?: { workerUsed?: boolean };
  [key: string]: unknown;
}

/**
 * Track analysis completion with key metrics.
 */
export function trackAnalysis(result: AnalysisResult | null | undefined): void {
  if (!result) return;
  trackEvent('analysis_complete', {
    exercise: result.exercise,
    reps: result.reps,
    formScore: result.formScore,
    duration: result.duration,
    analysisTime: result.analysisTime,
    fps: result.fps,
    frameCount: result.confidence?.totalFrames,
    confidence: result.confidence?.level,
    autoDetected: result.autoDetected,
    aborted: result.aborted || false,
    workerUsed: result.debug?.workerUsed,
  });
}

/**
 * Get session summary for diagnostics display.
 */
export function getSessionSummary(): {
  sessionId: string;
  uptime: number;
  eventCount: number;
  totalEvents: number;
  analyses: number;
} {
  const events = getEvents();
  const sessionEvents = events.filter(e => e.sid === sessionId);
  return {
    sessionId,
    uptime: Math.round((Date.now() - sessionStart) / 1000),
    eventCount: sessionEvents.length,
    totalEvents: events.length,
    analyses: sessionEvents.filter(e => e.name === 'analysis_complete').length,
  };
}

/**
 * Export all telemetry data (for user to view/download).
 */
export function exportTelemetry(): TelemetryEvent[] {
  return getEvents();
}

/**
 * Clear all telemetry data.
 */
export function clearTelemetry(): void {
  try { localStorage.removeItem(STORAGE_KEY); } catch {}
}
