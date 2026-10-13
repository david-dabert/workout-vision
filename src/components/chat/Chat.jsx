import { useState } from 'react';
import { useT } from '../../lib/LanguageContext';
import {
  createChatInvitationUrl,
} from '../../lib/p2p';
import './Chat.css';

export default function Chat({ onClose }) {
  const { lang } = useT();
  const fr = lang === 'fr';

  const [messages, setMessages] = useState([
    {
      id: 'm1',
      sender: 'peer',
      senderName: 'Coach Julien',
      text: fr
        ? 'Bonjour ! J’ai bien reçu ton invitation. Partage-moi ta dernière série pour que je regarde la symétrie et les partielles étirées.'
        : 'Hey! I connected to your private session. Share your latest set so I can review your symmetry and lengthened partials.',
      timestamp: Date.now() - 60000,
    },
  ]);

  const [inputVal, setInputVal] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);

  const handleSend = () => {
    if (!inputVal.trim()) return;
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
    setMessages(prev => [
      ...prev,
      {
        id: `m_tele_${Date.now()}`,
        sender: 'self',
        senderName: 'You',
        text: fr ? 'Voici le bilan biomécanique de ma dernière série :' : 'Here is the biomechanical summary of my latest set:',
        attachment: {
          type: 'telemetry_card',
          exerciseName: fr ? 'Développé Couché (Barre)' : 'Barbell Bench Press',
          repsCounted: 8,
          formScore: 92,
          symmetryIndexPct: 95,
          lengthenedPartialsCount: 2,
          timestamp: Date.now(),
        },
        timestamp: Date.now(),
      },
    ]);
  };

  const handleCopyInvite = () => {
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
          onClick={onClose || (() => { window.location.hash = ''; })}
          data-testid="chat-back-btn"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          {fr ? 'Retour' : 'Back'}
        </button>

        <div className="chat-topbar-info">
          <span className="chat-peer-name">Coach Julien, DPT</span>
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
          {copiedLink ? (fr ? '✓ Copié' : '✓ Copied') : (fr ? 'Lien d’invitation' : 'Invite Link')}
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
            📎 {fr ? 'Joindre ma dernière série' : 'Attach Last Set Telemetry'}
          </button>
        </div>

        <div className="chat-input-bar">
          <input
            type="text"
            className="chat-input"
            placeholder={fr ? 'Écrire un message privé...' : 'Write an encrypted message...'}
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
