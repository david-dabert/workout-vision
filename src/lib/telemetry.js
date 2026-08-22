/**
 * Minimal telemetry — fire-and-forget event logging.
 * Replace ENDPOINT with your actual analytics endpoint.
 */

const ENDPOINT = 'https://httpbin.org/post';

export function logEvent(event, data) {
  try {
    fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event,
        data,
        timestamp: Date.now(),
        userAgent: navigator.userAgent,
        screen: `${window.innerWidth}x${window.innerHeight}`,
      }),
    }).catch(() => {});
  } catch (_) {}
}
