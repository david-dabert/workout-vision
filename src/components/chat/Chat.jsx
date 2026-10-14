import { useState, useRef } from 'react';
import { useT } from '../../lib/LanguageContext';
import { useSets } from '../experience/sets';
import { hapticLight, hapticTap } from '../../lib/haptics';
import { useCondensingTopbar } from '../experience/topbar';
import { Topbar, DemoTag } from '../experience/Showcase';
import SendToCoach from '../coaches/SendToCoach';
import { lastSetLine } from '../coaches/last-set';
import './Chat.css';

// Messaging, a demo (honesty pass of 14 October 2026, CHT-1 to CHT-4). Nothing is sent and nothing is encrypted: the
// messages typed here stay in this screen's memory, on this phone, and are gone when the person leaves it. The screen
// says so. Gone: "Chiffré de bout en bout (P2P)", the scripted reply of "Coach Julien, DPT" to an invitation nobody
// sent, the "verified biomechanical summary" with a form score that was pose coverage, a symmetry that printed
// "[object Object] %" and 2 partials when the set had none, and the invitation link the app sent to its home screen.
// The way that works today to send a set to a coach is offered instead (SendToCoach). French awaiting David's
// approval (R10).

const COPY = {
  fr: {
    eyebrow: 'Messagerie, démo',
    title: 'Échanger avec votre coach',
    sub: 'Aucun message n’est envoyé. Ce que vous écrivez ici reste sur cet écran, sur ce téléphone, et s’efface quand vous le quittez.',
    none: 'Aucun message.',
    attach: 'Joindre ma dernière série',
    attached: line => `Ma dernière série\u00A0: ${line}.`,
    noSet: 'Aucune série sur ce téléphone pour l’instant.',
    label: 'Message',
    placeholder: 'Écrire un message',
    add: 'Ajouter',
    local: 'Sur ce téléphone',
  },
  en: {
    eyebrow: 'Messaging, demo',
    title: 'Talk to your coach',
    sub: 'No message is sent. What you write here stays on this screen, on this phone, and is gone when you leave it.',
    none: 'No message.',
    attach: 'Attach my last set',
    attached: line => `My last set: ${line}.`,
    noSet: 'No set on this phone yet.',
    label: 'Message',
    placeholder: 'Write a message',
    add: 'Add',
    local: 'On this phone',
  },
};

export default function Chat({ onClose, onHistory }) {
  const { lang } = useT();
  const fr = lang === 'fr';
  const c = COPY[fr ? 'fr' : 'en'];
  const sets = useSets();
  const [messages, setMessages] = useState([]);
  const [inputVal, setInputVal] = useState('');
  // The title condenses into the topbar as the page scrolls under it (topbar.js), as on Guide, History and Pro.
  const screenRef = useRef(null);
  useCondensingTopbar(screenRef, [lang]);

  const add = (text) => setMessages(prev => [...prev, { id: `m_${prev.length}_${text.length}`, text, at: new Date() }]);
  const handleSend = () => {
    if (!inputVal.trim()) return;
    hapticTap();
    add(inputVal.trim());
    setInputVal('');
  };
  const handleAttach = () => {
    hapticLight();
    const line = lastSetLine(sets, lang);
    add(line ? c.attached(line) : c.noSet);
  };
  const time = (t) => t.toLocaleTimeString(fr ? 'fr-FR' : 'en-GB', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="wv-experience">
      <section ref={screenRef} className="screen is-active sc-screen chat-screen" data-testid="chat-screen">
        <div className="wrap">
          <Topbar fr={fr} backTestId="chat-back-btn" onBack={() => { hapticLight(); if (onClose) onClose(); else window.location.hash = ''; }}>
            <DemoTag fr={fr} />
          </Topbar>

          <p className="eyebrow chat-status" data-reveal style={{ '--i': 0 }}>{c.eyebrow}</p>
          <h1 className="title" data-reveal style={{ '--i': 0 }}>{c.title}</h1>
          <p className="sub" data-reveal style={{ '--i': 1 }}>{c.sub}</p>

          <div className="sc-section" data-reveal style={{ '--i': 2 }}>
            <SendToCoach onHistory={onHistory} />
          </div>

          <div className="chat-feed" data-reveal style={{ '--i': 3 }} aria-live="polite">
            {messages.length === 0 ? <p className="sc-caption chat-empty">{c.none}</p> : messages.map(msg => (
              <div key={msg.id} className="chat-bubble chat-bubble-self" data-testid="chat-bubble">
                <p className="chat-text">{msg.text}</p>
                <span className="chat-timestamp">{c.local} · {time(msg.at)}</span>
              </div>
            ))}
          </div>

          <div className="chat-footer">
            <button type="button" className="sc-chip press chat-attach" onClick={handleAttach} data-testid="attach-telemetry-btn">{c.attach}</button>
            <div className="chat-input-bar">
              <label className="sr" htmlFor="chat-input">{c.label}</label>
              <input
                id="chat-input"
                type="text"
                className="chat-input"
                placeholder={c.placeholder}
                value={inputVal}
                onChange={e => setInputVal(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSend(); }}
                data-testid="chat-input"
              />
              <button type="button" className="chat-send-btn press" onClick={handleSend} data-testid="chat-send-btn">{c.add}</button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
