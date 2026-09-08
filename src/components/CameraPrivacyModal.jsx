import { useState } from 'react';
import { useT } from '../lib/LanguageContext';

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
  const { t } = useT();

  const items = [
    { label: t('privacy_ondevice_label'), desc: t('privacy_ondevice_desc') },
    { label: t('privacy_nocloud_label'), desc: t('privacy_nocloud_desc') },
    { label: t('privacy_noaccount_label'), desc: t('privacy_noaccount_desc') },
    { label: t('privacy_control_label'), desc: t('privacy_control_desc') },
  ];

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
          <h2 style={{ margin: 0, fontSize: 20 }}>{t('privacy_title')}</h2>
        </div>

        <div style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--text-secondary, #aaa)' }}>
          <p style={{ margin: '0 0 12px' }}>
            {t('privacy_intro')}
          </p>

          <ul style={{ margin: '0 0 16px', paddingLeft: 20 }}>
            {items.map((item, i) => (
              <li key={i} style={{ marginBottom: i < items.length - 1 ? 8 : 0 }}>
                <strong style={{ color: 'var(--text, #fff)' }}>{item.label}</strong>{' '}
                {item.desc}
              </li>
            ))}
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
          {t('privacy_accept')}
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
          {t('privacy_decline')}
        </button>
      </div>
    </div>
  );
}
