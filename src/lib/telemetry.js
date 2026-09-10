/**
 * Lightweight, privacy-first telemetry.
 * All data stays on-device (localStorage). No external calls.
 * Tracks performance metrics and usage patterns for debugging.
 */

const STORAGE_KEY = 'wv_telemetry';
const MAX_EVENTS = 200;

let sessionStart = Date.now();
let sessionId = Math.random().toString(36).slice(2, 10);

function getEvents() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function persistEvents(events) {
  try {
    // Keep only most recent events
    const trimmed = events.slice(-MAX_EVENTS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch { /* quota exceeded — silently drop */ }
}

/**
 * Log a telemetry event.
 * @param {string} name - Event name (e.g., 'analysis_complete', 'worker_init')
 * @param {Record<string, any>} [data] - Event payload
 */
export function trackEvent(name, data = {}) {
  const event = {
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
 * @param {string} name - Metric name
 * @param {Record<string, any>} [meta] - Additional metadata
 * @returns {() => number} stop function that returns duration in ms
 */
export function trackTiming(name, meta = {}) {
  const start = performance.now();
  return () => {
    const duration = Math.round(performance.now() - start);
    trackEvent(`timing_${name}`, { duration, ...meta });
    return duration;
  };
}

/**
 * Track analysis completion with key metrics.
 */
export function trackAnalysis(result) {
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
export function getSessionSummary() {
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
export function exportTelemetry() {
  return getEvents();
}

/**
 * Clear all telemetry data.
 */
export function clearTelemetry() {
  try { localStorage.removeItem(STORAGE_KEY); } catch {}
}
