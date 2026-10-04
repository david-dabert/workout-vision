// The camera for live counting (Live.jsx): opened for video only, never the microphone, and closed as soon as the
// screen no longer needs it. Its own small module, so the Film screen can ask whether a camera can open without
// loading the counting code.

/** What went wrong opening the camera, as the screen words it. */
export function cameraProblem(error) {
  const name = error?.name || '';
  if (name === 'NotAllowedError' || name === 'SecurityError' || name === 'PermissionDeniedError') return 'denied';
  if (name === 'NotFoundError' || name === 'OverconstrainedError' || name === 'DevicesNotFoundError') return 'nocamera';
  if (name === 'NotReadableError' || name === 'TrackStartError' || name === 'AbortError') return 'busy';
  if (name === 'NotSupportedError' || name === 'TypeError') return 'unsupported';
  return 'busy';
}

/** True where the browser can open the camera for the page at all. */
export const canOpenCamera = (nav = globalThis.navigator) => typeof nav?.mediaDevices?.getUserMedia === 'function';

/** Opens the camera on `facing` ('environment', the rear, or 'user'): video only, never the microphone. */
export async function openCamera(facing = 'environment', nav = globalThis.navigator) {
  if (!canOpenCamera(nav)) { const e = new Error('No camera API'); e.name = 'NotSupportedError'; throw e; }
  return nav.mediaDevices.getUserMedia({
    audio: false,
    video: { facingMode: { ideal: facing }, width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
  });
}

/** Stops every track of a camera stream, so the camera light goes off. */
export function closeCamera(stream) {
  try { stream?.getTracks().forEach(t => t.stop()); } catch { /* already stopped */ }
}

// The way of filming the person chose last on this phone, on the Film screen: a video ('video') or the live count
// ('live'). A convenience kept on the phone; nothing is sent. The video stays the default until David has checked
// live counting on his iPhone (R3).
const MODE_KEY = 'wv_film_mode';
export function readFilmMode() { try { return globalThis.localStorage?.getItem(MODE_KEY) === 'live' ? 'live' : 'video'; } catch { return 'video'; } }
export function writeFilmMode(mode) { try { globalThis.localStorage?.setItem(MODE_KEY, mode === 'live' ? 'live' : 'video'); } catch { /* holds for this visit */ } }
