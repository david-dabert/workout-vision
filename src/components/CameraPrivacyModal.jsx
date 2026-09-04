import { useState, useEffect } from 'react';

const PRIVACY_ACCEPTED_KEY = 'wv_privacy_accepted';

export function usePrivacyGate() {
  const [accepted, setAccepted] = useState(() => {
    try { return localStorage.getItem(PRIVACY_ACCEPTED_KEY) === '1'; }
    catch { return false; }
  });

  const accept = () => {
    try { localStorage.setItem(PRIVACY_ACCEPTED_KEY, '1'); }
    catch { /* no-op */ }
    setAccepted(true);
  };

  return { accepted, accept, showModal: !accepted };
}

export default function CameraPrivacyModal({ onAccept, onDecline }) {
  return (
    <div className="modal-backdrop" style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.85)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <div className="card" style={{
        maxWidth: 440, width: '100%', padding: '28px 24px',
        background: 'var(--surface, #1a1a2e)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 16,
      }}>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🔒</div>
          <h2 style={{ margin: 0, fontSize: 20 }}>Your Privacy Matters</h2>
        </div>

        <div style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--text-secondary, #aaa)' }}>
          <p style={{ margin: '0 0 12px' }}>
            WorkoutVision analyzes your exercise form using AI pose detection.
            Here is what you should know:
          </p>

          <ul style={{ margin: '0 0 16px', paddingLeft: 20 }}>
            <li style={{ marginBottom: 8 }}>
              <strong style={{ color: 'var(--text, #fff)' }}>100% on-device.</strong>{' '}
              Your video never leaves your phone. All AI processing happens locally in your browser.
            </li>
            <li style={{ marginBottom: 8 }}>
              <strong style={{ color: 'var(--text, #fff)' }}>No cloud uploads.</strong>{' '}
              No server ever sees your video, body measurements, or workout data.
            </li>
            <li style={{ marginBottom: 8 }}>
              <strong style={{ color: 'var(--text, #fff)' }}>No account required.</strong>{' '}
              No login, no email, no tracking. Your data stays in your browser.
            </li>
            <li>
              <strong style={{ color: 'var(--text, #fff)' }}>You are in control.</strong>{' '}
              Delete all data anytime from Settings. Video frames are discarded immediately after analysis.
            </li>
          </ul>
        </div>

        <button
          onClick={onAccept}
          className="btn btn-primary"
          style={{
            width: '100%', padding: '14px 20px', fontSize: 16,
            fontWeight: 600, borderRadius: 12, marginBottom: 10,
          }}
        >
          I Understand — Continue
        </button>
        <button
          onClick={onDecline}
          className="btn"
          style={{
            width: '100%', padding: '12px 20px', fontSize: 14,
            background: 'transparent', border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: 12, color: 'var(--text-secondary, #aaa)',
          }}
        >
          Go Back
        </button>
      </div>
    </div>
  );
}
