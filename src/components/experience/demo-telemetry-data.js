/**
 * Telemetry loader for the landing lab (DemoInteractiveLab.jsx): the pose, the joint angle and the reps the app read on
 * one real set, made by scripts/make-demo-telemetry.mjs through the app's own counting path, fetched on demand.
 *
 * There is no fallback data. An earlier version carried an invented set (7 reps, made-up angles and watts) to show if
 * the fetch failed: the one screen a first-time visitor opens must never show a number the app did not measure (R8).
 * When the telemetry cannot be fetched the lab plays the plain video and shows nothing drawn on it.
 */

/**
 * The clips the lab can open. `lift` is the app's key for the set; `joint` is read from the lift's definition.
 * The first is the lead: the sharpest, best-lit video, the same movement as the first card of the home screen, and a
 * set the app counts exactly (test/real-phone/sets-29sep/bicep_curl_5, label 5; scoreboard-baseline.json).
 */
export const LAB_CLIPS = {
  'bicep-curl-5': {
    id: 'bicep-curl-5',
    lift: 'bicep_curl',
    width: 540,
    height: 960,
    place: { fr: 'Basic-Fit', en: 'Basic-Fit' },
    name: { fr: 'Curl biceps', en: 'Biceps curl' },
  },
};

export const LEAD_LAB_CLIP = 'bicep-curl-5';

const cache = new Map();

/** The telemetry of a lab clip, or null when it cannot be fetched (the caller then shows the plain video). */
export async function loadDemoTelemetry(id = LEAD_LAB_CLIP) {
  if (cache.has(id)) return cache.get(id);
  try {
    const base = import.meta.env?.BASE_URL || '/';
    const res = await fetch(`${base}demo/${id}-telemetry.json`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    cache.set(id, data);
    return data;
  } catch {
    return null;
  }
}
