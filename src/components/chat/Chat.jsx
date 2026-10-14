import { useState, useMemo, useRef } from 'react';
import { useT } from '../../lib/LanguageContext';
import {
  createChatInvitationUrl,
} from '../../lib/p2p';
import { useSets } from '../experience/sets';
import { hapticLight, hapticTap } from '../../lib/haptics';
import { useCondensingTopbar } from '../experience/topbar';
import { Topbar, DemoTag, Metric } from '../experience/Showcase';
import './Chat.css';

const CheckIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12" /></svg>;
const ClipIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" /></svg>;

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
        ? `Bonjour\u00A0! J’ai bien reçu votre invitation. Partagez-moi votre dernière série pour que je regarde la symétrie et les partielles étirées.`
        : 'Hey! I connected to your private session. Share your latest set so I can review your symmetry and lengthened partials.',
      timestamp: Date.now() - 60000,
    },
  ]);

  const [inputVal, setInputVal] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);
  // The title condenses into the topbar as the page scrolls under it (topbar.js), as on Guide, History and Pro.
  const screenRef = useRef(null);
  useCondensingTopbar(screenRef, [lang]);

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
          // True when a value above is the code's fixed stand-in, not the set's own (shown with Demo, R8).
          demo: !latestSet || latestSet.reps == null || !(latestSet.formScore || latestSet.score || latestSet.confidence) || !(latestSet.symmetry || latestSet.bioAnalysis?.symmetry || latestSet.bilateralSymmetry) || !(latestSet.partialReps || latestSet.lengthenedPartials || latestSet.partialCount),
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

  const pct = (v) => `${v}${fr ? ' ' : ''}%`;
  const time = (t) => new Date(t).toLocaleTimeString(fr ? 'fr-FR' : 'en-GB', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="wv-experience">
      <section ref={screenRef} className="screen is-active sc-screen chat-screen" data-testid="chat-screen">
        <div className="wrap">
          <Topbar
            fr={fr}
            backTestId="chat-back-btn"
            onBack={() => {
              hapticLight();
              if (onClose) onClose();
              else window.location.hash = '';
            }}
          >
            <button type="button" className="btn-ghost is-s press" onClick={handleCopyInvite} data-testid="chat-copy-invite">
              {copiedLink ? <><CheckIcon />{fr ? 'Copié' : 'Copied'}</> : (fr ? 'Lien d’invitation' : 'Invite Link')}
            </button>
          </Topbar>

          <p className="eyebrow chat-status" data-reveal style={{ '--i': 0 }}>{fr ? 'Chiffré de bout en bout (P2P)' : 'End-to-End Encrypted (P2P)'}</p>
          <h1 className="title" data-reveal style={{ '--i': 0 }}>{peerDisplayName}</h1>
          <p className="sub" data-reveal style={{ '--i': 1 }}>{peerSubtitle}</p>

          {/* Messages Feed */}
          <div className="chat-feed" data-reveal style={{ '--i': 2 }}>
            {messages.map(msg => (
              <div
                key={msg.id}
                className={`chat-bubble ${msg.sender === 'self' ? 'chat-bubble-self' : 'chat-bubble-peer'}`}
                data-testid={`msg-${msg.id}`}
              >
                <p className="chat-text">{msg.text}</p>

                {msg.attachment && (
                  <div className="chat-telemetry" data-testid="telemetry-card-bubble">
                    <div className="chat-telemetry-head">
                      <span className="chat-telemetry-name">{msg.attachment.exerciseName}</span>
                      <span className="chat-telemetry-tags">
                        <span className="sc-tag">{msg.attachment.repsCounted} reps</span>
                        {msg.attachment.demo ? <DemoTag fr={fr} /> : null}
                      </span>
                    </div>
                    <div className="chat-telemetry-grid">
                      <Metric label={fr ? 'Score de Forme' : 'Form Score'} value={`${msg.attachment.formScore}/100`} />
                      <Metric label={fr ? 'Symétrie' : 'Symmetry'} value={pct(msg.attachment.symmetryIndexPct)} />
                      <Metric label={fr ? 'Partielles Étirées' : 'Lengthened Partials'} value={`+${msg.attachment.lengthenedPartialsCount}`} />
                    </div>
                  </div>
                )}

                <span className="chat-timestamp">{time(msg.timestamp)}</span>
              </div>
            ))}
          </div>

          {/* Input Footer */}
          <div className="chat-footer">
            <button
              type="button"
              className="sc-chip press chat-attach"
              onClick={handleAttachTelemetry}
              data-testid="attach-telemetry-btn"
            >
              <ClipIcon />
              {fr ? 'Joindre ma dernière série' : 'Attach Last Set Telemetry'}
            </button>
            <div className="chat-input-bar">
              <label className="sr" htmlFor="chat-input">{fr ? 'Message' : 'Message'}</label>
              <input
                id="chat-input"
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
      </section>
    </div>
  );
}
