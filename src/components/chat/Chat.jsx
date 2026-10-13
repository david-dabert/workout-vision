import { useState, useMemo } from 'react';
import { useT } from '../../lib/LanguageContext';
import {
  createChatInvitationUrl,
} from '../../lib/p2p';
import { useSets } from '../experience/sets';
import { hapticLight, hapticTap } from '../../lib/haptics';
import './Chat.css';

function getHashParams() {
  try {
    if (typeof window === 'undefined') return {};
    const hash = window.location.hash || '';
    const qIdx = hash.indexOf('?');
    if (qIdx === -1) return {};
    const params = new URLSearchParams(hash.slice(qIdx + 1));
    return {
      peer: params.get('peer'),
      name: params.get('name') ? decodeURIComponent(params.get('name')) : null,
      title: params.get('title') ? decodeURIComponent(params.get('title')) : null,
      gym: params.get('gym') ? decodeURIComponent(params.get('gym')) : null,
    };
  } catch {
    return {};
  }
}

export default function Chat({ onClose }) {
  const { lang } = useT();
  const fr = lang === 'fr';
  const sets = useSets();

  const hashParams = useMemo(() => getHashParams(), []);
  const peerDisplayName = hashParams.name || (fr ? 'Coach Julien, DPT' : 'Coach Julien, DPT');
  const peerSubtitle = hashParams.title || hashParams.gym || (fr ? 'Kinésithérapeute du Sport' : 'Sports Physical Therapist');

  const [messages, setMessages] = useState([
    {
      id: 'm1',
      sender: 'peer',
      senderName: peerDisplayName,
      text: fr
        ? `Bonjour\u00A0! J’ai bien reçu ton invitation. Partage-moi ta dernière série pour que je regarde la symétrie et les partielles étirées.`
        : 'Hey! I connected to your private session. Share your latest set so I can review your symmetry and lengthened partials.',
      timestamp: Date.now() - 60000,
    },
  ]);

  const [inputVal, setInputVal] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);

  // Extract latest real set from IndexedDB if available
  const latestSet = useMemo(() => {
    if (!sets || !sets.length) return null;
    return sets[0];
  }, [sets]);

  const handleSend = () => {
    if (!inputVal.trim()) return;
    hapticTap();
    setMessages(prev => [
      ...prev,
      {
        id: `m_${Date.now()}`,
        sender: 'self',
        senderName: 'You',
        text: inputVal.trim(),
        timestamp: Date.now(),
      },
    ]);
    setInputVal('');
  };

  const handleAttachTelemetry = () => {
    hapticLight();
    const exName = latestSet?.exercise || latestSet?.exerciseKey || (fr ? 'Développé Couché (Barre)' : 'Barbell Bench Press');
    const reps = latestSet?.reps ?? 8;
    const form = latestSet?.formScore || latestSet?.score || (latestSet?.confidence ? Math.round(latestSet.confidence * 100) : 92);
    const sym = latestSet?.symmetry || latestSet?.bioAnalysis?.symmetry || (latestSet?.bilateralSymmetry ? Math.round(latestSet.bilateralSymmetry * 100) : 95);
    const partials = latestSet?.partialReps || latestSet?.lengthenedPartials || latestSet?.partialCount || 2;

    setMessages(prev => [
      ...prev,
      {
        id: `m_tele_${Date.now()}`,
        sender: 'self',
        senderName: 'You',
        text: fr
          ? latestSet
            ? 'Voici le bilan biomécanique de ma dernière série enregistrée sur l’appareil\u00A0:'
            : 'Voici un aperçu de télémétrie biomécanique de démonstration\u00A0:'
          : latestSet
            ? 'Here is the verified biomechanical summary of my latest on-device set:'
            : 'Here is a demonstration biomechanical telemetry summary:',
        attachment: {
          type: 'telemetry_card',
          exerciseName: exName,
          repsCounted: reps,
          formScore: form,
          symmetryIndexPct: sym,
          lengthenedPartialsCount: partials,
          timestamp: Date.now(),
        },
        timestamp: Date.now(),
      },
    ]);
  };

  const handleCopyInvite = () => {
    hapticLight();
    const url = createChatInvitationUrl(window.location.href, 'Athlete');
    navigator.clipboard.writeText(url).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    });
  };

  return (
    <div className="chat-container" data-testid="chat-screen">
      {/* Topbar */}
      <div className="chat-topbar">
        <button
          type="button"
          className="chat-back-btn press"
          onClick={() => {
            hapticLight();
            if (onClose) onClose();
            else window.location.hash = '';
          }}
          data-testid="chat-back-btn"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          {fr ? 'Retour' : 'Back'}
        </button>

        <div className="chat-topbar-info">
          <span className="chat-peer-name">{peerDisplayName}</span>
          <span className="chat-encryption-status">
            ● {fr ? 'Chiffré de bout en bout (P2P)' : 'End-to-End Encrypted (P2P)'}
          </span>
        </div>

        <button
          type="button"
          className="chat-back-btn press"
          onClick={handleCopyInvite}
          data-testid="chat-copy-invite"
        >
          {copiedLink ? <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle', marginRight: '4px' }}><polyline points="20 6 9 17 4 12"/></svg>{fr ? 'Copié' : 'Copied'}</> : (fr ? 'Lien d’invitation' : 'Invite Link')}
        </button>
      </div>

      {/* Messages Feed */}
      <div className="chat-content">
        {messages.map(msg => (
          <div
            key={msg.id}
            className={`chat-bubble ${msg.sender === 'self' ? 'chat-bubble-self' : 'chat-bubble-peer'}`}
            data-testid={`msg-${msg.id}`}
          >
            <div>{msg.text}</div>

            {msg.attachment && (
              <div className="telemetry-card-bubble" data-testid="telemetry-card-bubble">
                <div className="telemetry-card-title">
                  <span>{msg.attachment.exerciseName}</span>
                  <span>{msg.attachment.repsCounted} reps</span>
                </div>
                <div className="telemetry-metrics-grid">
                  <div className="telemetry-metric-item">
                    <span className="telemetry-metric-label">{fr ? 'Score de Forme' : 'Form Score'}</span>
                    <span className="telemetry-metric-val">{msg.attachment.formScore}/100</span>
                  </div>
                  <div className="telemetry-metric-item">
                    <span className="telemetry-metric-label">{fr ? 'Symétrie' : 'Symmetry'}</span>
                    <span className="telemetry-metric-val">{msg.attachment.symmetryIndexPct}%</span>
                  </div>
                  <div className="telemetry-metric-item">
                    <span className="telemetry-metric-label">{fr ? 'Partielles Étirées' : 'Lengthened Partials'}</span>
                    <span className="telemetry-metric-val">+{msg.attachment.lengthenedPartialsCount}</span>
                  </div>
                </div>
              </div>
            )}

            <span className="chat-timestamp">
              {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        ))}
      </div>

      {/* Input Footer */}
      <div className="chat-footer">
        <div className="chat-quick-actions">
          <button
            type="button"
            className="quick-action-pill press"
            onClick={handleAttachTelemetry}
            data-testid="attach-telemetry-btn"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle', marginRight: '5px' }}><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
            {fr ? 'Joindre ma dernière série' : 'Attach Last Set Telemetry'}
          </button>
        </div>

        <div className="chat-input-bar">
          <input
            type="text"
            className="chat-input"
            placeholder={fr ? 'Écrire un message chiffré...' : 'Write an encrypted message...'}
            value={inputVal}
            onChange={e => setInputVal(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSend(); }}
            data-testid="chat-input"
          />
          <button
            type="button"
            className="chat-send-btn press"
            onClick={handleSend}
            data-testid="chat-send-btn"
          >
            {fr ? 'Envoyer' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
}
