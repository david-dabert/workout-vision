import { useT } from '../../lib/LanguageContext';
import { ABOUT, DEMOS, PHOTOS } from './about-copy';
import './About.css';

// One photo of public/about/, with its pixel size so its place is kept before it loads. Only the portrait, at the
// top, loads at once.
function Photo({ id, alt, caption, eager = false }) {
  const p = PHOTOS[id];
  const img = <img src={`${import.meta.env.BASE_URL}about/${p.file}`} width={p.width} height={p.height} alt={alt}
    loading={eager ? undefined : 'lazy'} decoding="async" />;
  // The portrait reveals with the title; the others come with the text around them.
  return <figure className={`about-photo about-${id}`} {...(eager ? { 'data-reveal': true, style: { '--i': 0 } } : {})}>
    {img}
    {caption && <figcaption>{caption}</figcaption>}
  </figure>;
}

// A set as the app saw it: its replay, muted, looping, its first frame shown until it plays.
function Demo({ d, fr }) {
  const base = `${import.meta.env.BASE_URL}demo/${d.file}`;
  return <figure className="about-photo about-demo">
    <video src={`${base}.mp4`} poster={`${base}.jpg`} width={d.width} height={d.height} muted loop playsInline autoPlay preload="metadata" aria-label={fr ? d.fr : d.en} />
    <figcaption>{fr ? d.fr : d.en}</figcaption>
  </figure>;
}

const Paragraph = ({ lines }) => <p className="about-p">{lines.map(line => <span key={line} className="about-line">{line}</span>)}</p>;

/** "À propos": why the app exists, in David's words (about-copy.js). */
export default function About({ onClose }) {
  const { lang } = useT(), fr = lang === 'fr';
  const c = ABOUT[fr ? 'fr' : 'en'], [p1, p2, p3, p4, p5] = c.paragraphs;
  return <div className="wv-experience">
    <section className="screen is-active about-screen"><div className="wrap">
      <div className="topbar">
        <button className="icon-btn press" onClick={onClose} aria-label={fr ? 'Retour' : 'Back'}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg></button>
        <span className="pill">{fr ? 'Version de test' : 'Test version'}</span>
      </div>
      <Photo id="portrait" alt={c.photos.portrait.alt} eager />
      <h1 className="title" data-reveal style={{ '--i': 1 }}>{c.title}</h1>
      <div className="about-body" data-reveal style={{ '--i': 2 }}>
        <Paragraph lines={p1} />
        <Photo id="sanSiro" {...c.photos.sanSiro} />
        <Paragraph lines={p2} />
        <Photo id="dordogne" {...c.photos.dordogne} />
        <Paragraph lines={p3} />
        <Paragraph lines={p4} />
        {DEMOS.map(d => <Demo key={d.file} d={d} fr={fr} />)}
        <Paragraph lines={p5} />
        <p className="about-signature">{c.signature}</p>
      </div>
    </div></section>
  </div>;
}
