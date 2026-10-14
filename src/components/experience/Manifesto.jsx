import { useState, useEffect, useRef } from 'react';
import { useT } from '../../lib/LanguageContext';
import { MANIFESTO } from './manifesto-copy';
import Formula from './Formula';
import './Manifesto.css';

/**
 * The WorkoutVision Manifesto: The Science, History, and Mechanics of Optimal Lifting
 * An editorial reading experience bridging academic exercise physiology and physical execution.
 */
export default function Manifesto({ onClose, onChoose }) {
  const { lang, setLang } = useT();
  const fr = lang === 'fr';
  const c = MANIFESTO[fr ? 'fr' : 'en'];

  // Scroll reading progress indicator
  const [progress, setProgress] = useState(0);
  // Font scale (default 17px, +2px, -2px)
  const [fontSize, setFontSize] = useState(17);
  const screenRef = useRef(null);

  useEffect(() => {
    const handleScroll = () => {
      const el = document.documentElement;
      const total = el.scrollHeight - el.clientHeight;
      if (total > 0) {
        const current = el.scrollTop || document.body.scrollTop;
        setProgress(Math.min(100, Math.max(0, (current / total) * 100)));
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const toggleLanguage = () => {
    if (setLang) setLang(fr ? 'en' : 'fr');
  };

  const adjustFont = (delta) => {
    setFontSize(prev => Math.min(22, Math.max(14, prev + delta)));
  };

  const jumpTo = (id) => {
    const target = document.getElementById(id);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleAction = (liftKey) => {
    if (onChoose && liftKey) {
      onChoose(liftKey);
    } else if (onClose) {
      onClose();
    }
  };

  return (
    <div className="wv-experience" ref={screenRef} style={{ '--manifesto-font-size': `${fontSize}px` }}>
      {/* Sticky Reading Progress Bar */}
      <div className="manifesto-progress-container" aria-hidden="true">
        <div className="manifesto-progress-bar" style={{ width: `${progress}%` }} />
      </div>

      <section className="screen is-active manifesto-screen">
        <div className="wrap">
          {/* Topbar navigation & Reader controls */}
          <header className="manifesto-topbar">
            <button className="icon-btn press" onClick={onClose} aria-label={fr ? 'Retour' : 'Back'}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M15 6l-6 6 6 6" />
              </svg>
            </button>
            <div className="manifesto-tools">
              <button type="button" className="manifesto-tool-btn press" onClick={() => adjustFont(-1)} aria-label="Smaller text">A-</button>
              <button type="button" className="manifesto-tool-btn press" onClick={() => adjustFont(1)} aria-label="Larger text">A+</button>
              <button type="button" className="manifesto-tool-btn press" onClick={toggleLanguage} aria-label="Toggle language">
                {fr ? 'EN' : 'FR'}
              </button>
            </div>
          </header>

          {/* Hero Banner */}
          <div className="manifesto-header">
            <span className="manifesto-badge">{c.badge}</span>
            <h1 className="manifesto-title">{c.title}</h1>
            <p className="manifesto-subtitle">{c.subtitle}</p>
            <div className="manifesto-meta">
              <span>{c.readTime}</span>
              <span>•</span>
              <span>WorkoutVision Edition</span>
            </div>
          </div>

          {/* Table of Contents */}
          <nav className="manifesto-toc" aria-label={c.tocTitle}>
            <h2 className="manifesto-toc-title">{c.tocTitle}</h2>
            <ol className="manifesto-toc-list">
              {c.chapters.map((ch) => (
                <li key={ch.id}>
                  <a
                    href={`#${ch.id}`}
                    className="manifesto-toc-link"
                    onClick={(e) => { e.preventDefault(); jumpTo(ch.id); }}
                  >
                    <b>{ch.title}</b><small>{ch.subtitle}</small>
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          {/* Article Main Body */}
          <article className="manifesto-body">
            <blockquote className="manifesto-lead">{c.lead}</blockquote>
            <p className="manifesto-p dropcap">{c.introP1}</p>
            <p className="manifesto-p">{c.introP2}</p>

            {/* Chapter 1: The Evolution of Sports Science */}
            <section id="ch1" className="manifesto-chapter">
              <span className="manifesto-chapter-num">{c.chapter1.number}</span>
              <h2 className="manifesto-chapter-title">{c.chapter1.title}</h2>
              <p className="manifesto-p">{c.chapter1.intro}</p>

              {c.chapter1.sections.map((sec, idx) => (
                <div key={idx} className="manifesto-section">
                  <h3 className="manifesto-section-title">{sec.title}</h3>
                  <p className="manifesto-p">{sec.text}</p>
                  <div className="manifesto-cards">
                    {sec.figures.map((fig, fIdx) => (
                      <div key={fIdx} className="manifesto-card">
                        <div className="manifesto-card-head">
                          <span className="manifesto-card-name">{fig.name}</span>
                          <span className="manifesto-card-role">{fig.role}</span>
                          <span className="manifesto-card-dates">{fig.dates}</span>
                        </div>
                        <p className="manifesto-card-desc">{fig.desc}</p>
                        {fig.formula && (
                          <div className="manifesto-formula-box">
                            <div className="manifesto-formula-code"><Formula tex={fig.formula} fr={fr} /></div>
                            {fig.formulaNote && <p className="manifesto-formula-note">{fig.formulaNote}</p>}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </section>

            {/* Chapter 2: The Giants of Human Performance */}
            <section id="ch2" className="manifesto-chapter">
              <span className="manifesto-chapter-num">{c.chapter2.number}</span>
              <h2 className="manifesto-chapter-title">{c.chapter2.title}</h2>
              <p className="manifesto-p">{c.chapter2.intro}</p>

              {c.chapter2.subsections.map((sub, sIdx) => (
                <div key={sIdx} className="manifesto-section">
                  <h3 className="manifesto-section-title">{sub.heading}</h3>
                  <div className="manifesto-cards">
                    {sub.leaders.map((ldr, lIdx) => (
                      <div key={lIdx} className="manifesto-card">
                        <div className="manifesto-card-head">
                          <span className="manifesto-card-name">{ldr.name}</span>
                          <span className="manifesto-card-role">{ldr.specialty}</span>
                          <span className="manifesto-card-dates">{ldr.affiliation}</span>
                        </div>
                        <p className="manifesto-card-desc">{ldr.summary}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </section>

            {/* Chapter 3: Why Science-Based Lifting is Superior */}
            <section id="ch3" className="manifesto-chapter">
              <span className="manifesto-chapter-num">{c.chapter3.number}</span>
              <h2 className="manifesto-chapter-title">{c.chapter3.title}</h2>
              <p className="manifesto-p">{c.chapter3.intro}</p>

              <div className="manifesto-rules-list">
                {c.chapter3.principles.map((pr, pIdx) => (
                  <div key={pIdx} className="manifesto-rule">
                    <h3 className="manifesto-rule-title">{pr.title}</h3>
                    <p className="manifesto-rule-desc">{pr.desc}</p>
                    {pr.formula && (
                      <div className="manifesto-formula-box">
                        <div className="manifesto-formula-code"><Formula tex={pr.formula} fr={fr} /></div>
                      </div>
                    )}
                    <div className="manifesto-rule-app">
                      <b>{fr ? 'Implication clé\u00A0:' : 'Key takeaway:'}</b> {pr.highlight}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Chapter 4: The Mechanics of Optimal Gains */}
            <section id="ch4" className="manifesto-chapter">
              <span className="manifesto-chapter-num">{c.chapter4.number}</span>
              <h2 className="manifesto-chapter-title">{c.chapter4.title}</h2>
              <p className="manifesto-p">{c.chapter4.intro}</p>

              <div className="manifesto-rules-list">
                {c.chapter4.rules.map((rl, rIdx) => (
                  <div key={rIdx} className="manifesto-rule">
                    <span className="manifesto-rule-num">{rl.num}</span>
                    <h3 className="manifesto-rule-title">{rl.name}</h3>
                    <p className="manifesto-rule-desc">{rl.body}</p>
                    <div className="manifesto-rule-app">
                      <b>{fr ? 'Mise en pratique\u00A0:' : 'Practical application:'}</b> {rl.application}
                    </div>
                    {rl.liftKey && (
                      <div className="manifesto-rule-action">
                        <button
                          type="button"
                          className="manifesto-action-btn press"
                          onClick={() => handleAction(rl.liftKey)}
                        >
                          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <polygon points="5 3 19 12 5 21 5 3" />
                          </svg>
                          <span>{rl.liftLabel}</span>
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>

            {/* Conclusion */}
            <section id="conclusion" className="manifesto-conclusion">
              <h2 className="manifesto-chapter-title">{c.conclusion.title}</h2>
              <p className="manifesto-p">{c.conclusion.text1}</p>
              <p className="manifesto-p">{c.conclusion.text2}</p>
              <p className="manifesto-creed">{c.conclusion.creed}</p>
            </section>

            {/* Footer Call to Action */}
            <div className="manifesto-footer-cta">
              <button
                type="button"
                className="manifesto-main-btn press"
                onClick={onClose}
              >
                {c.cta.startFilming}
              </button>
            </div>
          </article>
        </div>
      </section>
    </div>
  );
}
