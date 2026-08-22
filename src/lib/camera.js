/**
 * Camera utilities with explicit error handling.
 */

export class CameraError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'CameraError';
    this.code = code;
  }
}

export async function initCamera(videoRef, facingMode = 'user') {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false,
    });
    videoRef.srcObject = stream;
    await videoRef.play();
    return stream;
  } catch (err) {
    if (err.name === 'NotAllowedError') {
      throw new CameraError(
        'Camera permission denied. Please allow camera access in your browser settings, then tap Retry.',
        'PERMISSION_DENIED'
      );
    } else if (err.name === 'NotFoundError') {
      throw new CameraError(
        'No camera found. Please connect a camera or use Manual Log mode.',
        'NO_CAMERA'
      );
    } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
      throw new CameraError(
        'Camera is in use by another app. Close other apps and try again.',
        'CAMERA_IN_USE'
      );
    } else {
      throw new CameraError(`Camera error: ${err.message}`, 'UNKNOWN');
    }
  }
}

export function stopCamera(stream) {
  if (!stream) return;
  stream.getTracks().forEach(track => track.stop());
}
