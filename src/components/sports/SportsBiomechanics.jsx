import { useState, useRef, useEffect } from 'react';
import { useT } from '../../lib/LanguageContext';
import { golfTempoRatio, rowingRhythmRatio, GOLF_TEMPO_REFERENCE, ROWING_RATIO_REFERENCE } from '../../lib/sports/kinematics';
import { hapticLight } from '../../lib/haptics';
import { useCondensingTopbar } from '../experience/topbar';
import { Topbar, DemoTag, PreviewTag, Metric, Range } from '../experience/Showcase';
import { num, reducedMotion, NBSP } from '../experience/showcase-text';
import { SPORTS_COPY } from './sports-copy';
// The screen's own styles, in the experience's wrapper with its tokens (Showcase.css, design/SYSTEM.md).
import './SportsBiomechanics.css';

// The sports lab, after the honesty pass of 14 October 2026 (audit SP-01 to SP-30). Per sport: the demonstration clip
// as it was filmed, under a Démo badge, with nothing read on it; what a phone video could measure once built (none of
// it is measured today) and what it cannot, with the reason. Golf and rowing add a calculator: the ratio of two
// durations set with sliders, beside a published coaching reference, with no grade. A visitor's own video plays as it
// is, with the statement that nothing is read on it.
//
// No longer shown: the pre-rendered "analysed" clips and their posters (constant verdicts, athlete names, "ASMI",
// "0ms CLOUD" burned in), the typed "key figures", licence tags, the download, the launch-monitor price table, the
// copied report, the landmark presets and the slider "scores", torques, speeds and G loads. The video files stay on
// disk (R5); their removal from the repository is David's call (PLAN.md, no video file tracked).

const BASE_URL = import.meta.env.BASE_URL || '/';
// The sports of the rail, in its order; volleyball and equitation open their own screens.
const SPORTS = ['golf', 'tennis', 'padel', 'baseball', 'cycling', 'rowing', 'skiing', 'swimming'];
// The raw clip, as filmed. #t=0.1 shows its first frame on iOS when it does not play on its own (Reduce Motion).
const clipUrl = s => `${BASE_URL}demo/sports/${s}-demo-raw.mp4#t=0.1`;
// The analysed version of the same clip: skeleton and figures burned into the picture by an earlier tool (commit
// 5109027), shown since 14 October 2026 as a preview of where the app is going, labelled « Aperçu », never as measured
// (David: "it sends a message about what we are trying to build").
const previewUrl = s => `${BASE_URL}demo/sports/${s}-demo-analyzed.mp4#t=0.1`;

// The putt, a second golf clip, shown as filmed below the swing (15 October 2026, David): no skeleton, no figure.
// Source: Wikimedia Commons, File:Golfputt.ogv, author Grillo, CC BY-SA 3.0 (read from the Commons API, #190).
const PUTT_URL = `${BASE_URL}demo/sports/golf-putt-demo-raw.mp4#t=0.1`;
const PUTT_POSTER_URL = `${BASE_URL}demo/sports/golf-putt-demo-poster.jpg`;
const PUTT_FILE_PAGE = 'https://commons.wikimedia.org/wiki/File:Golfputt.ogv';
const PUTT_LICENSE_URL = 'https://creativecommons.org/licenses/by-sa/3.0/';

// The muted attribute itself, not only React's property: iOS lets a clip play on its own only when it is muted, and
// React writes muted as a property (status convention: WebKit's autoplay policy; to confirm on David's iPhone).
const muteVideo = el => { if (el) { el.muted = true; el.setAttribute('muted', ''); } };

const SvgVideo = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>;
const ArrowIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>;

/**
 * A calculator: two durations set with sliders, drawn to scale as two segments, their ratio, and the reference's own
 * split as a tick on the bar. The ratio is the slider values' and nothing else; no grade is given.
 */
function RatioCalc({ kind, c, fr }) {
  const golf = kind === 'golf';
  // Starting values off the reference, so the bar shows the gap to it. Status: convention (display only).
  const [a, setA] = useState(golf ? 720 : 700);
  const [b, setB] = useState(golf ? 260 : 1200);
  const ratio = golf ? golfTempoRatio(a, b) : rowingRhythmRatio(a, b);
  const ref = golf ? GOLF_TEMPO_REFERENCE : ROWING_RATIO_REFERENCE;
  // The share of the bar the first segment takes at the reference ratio: 3:1 puts the split at 3/4, 1:2 at 1/3.
  const refAt = golf ? ref / (ref + 1) : 1 / (1 + ref);
  const shown = ratio === null ? c.noRatio : golf ? `${num(ratio.toFixed(1), fr)}${NBSP}:${NBSP}1` : `1${NBSP}:${NBSP}${num(ratio.toFixed(1), fr)}`;
  const refText = golf ? `${ref}${NBSP}:${NBSP}1` : `1${NBSP}:${NBSP}${ref}`;
  const [la, lb] = golf ? [c.golfUpShort, c.golfDownShort] : [c.rowDriveShort, c.rowRecoveryShort];
  const ms = v => `${v}${NBSP}ms`;
  // A segment narrower than its words keeps only its colour: no word is ever cut, and both durations stay on the
  // sliders' lines below. The bar's width is measured; a word's width is estimated from the type, Geist Mono at
  // 10.5 px with its tracking (about 7.2 px a character) for the name, 13 px figures (about 7.5 px) for the value, plus
  // 10 px of padding each side (status convention: display only). Before the first measure every word shows.
  const barRef = useRef(null);
  const [barW, setBarW] = useState(0);
  useEffect(() => {
    const el = barRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(() => setBarW(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const fits = (share, text, perChar) => !barW || (barW - 3) * share >= text.length * perChar + 20;
  const seg = (v, label, share) => <>
    {fits(share, label, 7.2) ? <span>{label}</span> : null}
    {fits(share, ms(v), 7.5) ? <b>{ms(v)}</b> : null}
  </>;
  return (
    <section className="sc-section sports-calc" data-testid={`sports-calc-${kind}`}>
      <div className="sc-head">
        <h2 className="sc-head-title">{c.refHead[kind]}</h2>
        <span className="sc-head-tags"><span className="sc-tag">{c.calcTag}</span></span>
      </div>
      <p className="sc-caption">{c.fromSliders}</p>
      <div className="sports-bar" role="img" aria-label={c.barLabel(`${la} ${ms(a)}`, `${lb} ${ms(b)}`)} ref={barRef}>
        <span className={`sports-bar-seg ${golf ? 'is-quiet' : 'is-lamp'}`} style={{ flexGrow: a }}>{seg(a, la, a / (a + b))}</span>
        <span className={`sports-bar-seg ${golf ? 'is-lamp' : 'is-quiet'}`} style={{ flexGrow: b }}>{seg(b, lb, b / (a + b))}</span>
        <span className="sports-bar-ref" style={{ left: `${(refAt * 100).toFixed(2)}%` }} aria-hidden="true" />
      </div>
      <p className="sports-bar-mark" aria-hidden="true"><span style={{ left: `clamp(56px, ${(refAt * 100).toFixed(2)}%, calc(100% - 56px))` }}>{c.refMark(refText)}</span></p>
      <div className="sc-metrics">
        <Metric wide label={golf ? c.golfRatio : c.rowRatio} value={shown} text={ratio === null} sub={golf ? c.golfRef : c.rowRef} testId={`sports-ratio-${kind}`} />
      </div>
      <div className="sc-ranges">
        {golf ? <>
          <Range label={c.golfUp} display={ms(a)} min={400} max={1000} step={10} value={a} onChange={e => setA(Number(e.target.value))} />
          <Range label={c.golfDown} display={ms(b)} min={180} max={350} step={10} value={b} onChange={e => setB(Number(e.target.value))} />
        </> : <>
          <Range label={c.rowDrive} display={ms(a)} min={400} max={900} step={25} value={a} onChange={e => setA(Number(e.target.value))} />
          <Range label={c.rowRecovery} display={ms(b)} min={800} max={1800} step={50} value={b} onChange={e => setB(Number(e.target.value))} />
        </>}
      </div>
    </section>
  );
}

/** The visitor's own video, played as it is, with the statement that nothing is read on it. Exported for its test. */
export function SportsOwnVideo({ c, video, onClose }) {
  return (
    <div className="sc-section" data-testid="sports-uploaded-card">
      <div className="sc-file">
        <span className="sc-file-name"><SvgVideo /><span>{video.name}</span></span>
        <button type="button" className="btn-ghost is-s press" onClick={onClose} data-testid="sports-close-video">{c.close}</button>
      </div>
      <div className="sc-frame">
        {/* #t=0.1 shows the video's first frame on iOS before it plays, as for the demo clips. */}
        <video key={video.url} src={`${video.url}#t=0.1`} controls playsInline preload="metadata" data-testid="sports-own-video" />
      </div>
      <div className="sc-card sports-own" role="status" data-testid="sports-own-statement">
        <h3 className="sports-own-title">{c.ownHead}</h3>
        <p className="sc-text">{c.ownText}</p>
        <p className="sc-caption">{c.stays}</p>
      </div>
    </div>
  );
}

export default function SportsBiomechanics({ sport, onClose, onOpenEquine, onOpenVolleyball }) {
  const { lang } = useT();
  const fr = lang === 'fr';
  const c = SPORTS_COPY[lang] ?? SPORTS_COPY.en;
  // The title condenses into the topbar as the page scrolls under it (topbar.js), as on Guide, History and Pro.
  const screenRef = useRef(null);
  useCondensingTopbar(screenRef, [lang]);
  const [reduced] = useState(reducedMotion);
  // A sport's own address (#golf, #rowing...) opens on that sport (SP-27).
  const [activeSport, setActiveSport] = useState(SPORTS.includes(sport) ? sport : 'golf');
  // The preview first, so the screen shows at once what the app aims to do; the plain clip one tap away.
  const [view, setView] = useState('preview');
  const sp = c.sports[activeSport];

  // The visitor's video: an object URL, released when another replaces it, when it is closed and when the screen goes.
  const fileInputRef = useRef(null);
  const ownUrl = useRef(null);
  const [own, setOwn] = useState(null);
  useEffect(() => () => { if (ownUrl.current) URL.revokeObjectURL(ownUrl.current); }, []);

  // A sport opened by its address can sit past the rail's edge: the rail scrolls itself (and only itself, never the
  // page) so the selected chip is in view, centred when it can be.
  const railRef = useRef(null);
  useEffect(() => {
    const rail = railRef.current, chip = rail?.querySelector('[aria-pressed="true"]');
    if (!rail || !chip) return;
    const r = rail.getBoundingClientRect(), k = chip.getBoundingClientRect();
    const target = rail.scrollLeft + (k.left - r.left) - (r.width - k.width) / 2;
    rail.scrollLeft = Math.max(0, Math.min(target, rail.scrollWidth - rail.clientWidth));
  }, []);
  const handleOpen = e => {
    const file = e.target.files?.[0];
    e.target.value = ''; // the same file can be chosen again
    if (!file) return;
    hapticLight();
    if (ownUrl.current) URL.revokeObjectURL(ownUrl.current);
    ownUrl.current = URL.createObjectURL(file);
    setOwn({ url: ownUrl.current, name: file.name });
  };
  const handleClose = () => {
    hapticLight();
    if (ownUrl.current) URL.revokeObjectURL(ownUrl.current);
    ownUrl.current = null;
    setOwn(null);
  };

  return (
    <div className="wv-experience">
      <section ref={screenRef} className="screen is-active sc-screen sports-screen" data-testid="sports-biomechanics-screen">
        <div className="wrap">
          <input type="file" ref={fileInputRef} accept="video/*" style={{ display: 'none' }} onChange={handleOpen} data-testid="sports-video-input" />

          <Topbar
            fr={fr}
            backTestId="sports-back-btn"
            onBack={() => {
              hapticLight();
              if (onClose) onClose();
              else window.location.hash = '';
            }}
          />

          <p className="eyebrow" data-reveal style={{ '--i': 0 }}>{c.eyebrow}</p>
          <h1 className="title" data-reveal style={{ '--i': 0 }}>{c.title}</h1>
          <p className="sub" data-reveal style={{ '--i': 1 }}>{c.sub}</p>
          <div className="sc-actions" data-reveal style={{ '--i': 2 }}>
            <button type="button" className="btn-ghost is-s press" onClick={() => { hapticLight(); fileInputRef.current?.click(); }} data-testid="sports-upload-btn">
              <SvgVideo />{c.open}
            </button>
          </div>

          {own && <SportsOwnVideo c={c} video={own} onClose={handleClose} />}

          {/* The sports, one rail: names only, so a chip never promises a measure. */}
          <div className="sc-section sports-rail-section" data-reveal style={{ '--i': 3 }}>
            <div className="sc-rail" role="group" aria-label={c.railLabel} ref={railRef}>
              {SPORTS.map(k => (
                <button key={k} type="button" className="sc-chip press" aria-pressed={activeSport === k} onClick={() => { hapticLight(); setActiveSport(k); }} data-testid={`tab-${k}`}>
                  {c.sports[k].name}
                </button>
              ))}
              {/* Volleyball opens the activity engine's screen: its numbers are measured on synthetic jumps. French 'Volley-ball': written 14 October 2026, awaiting David's approval (R10). */}
              {onOpenVolleyball && (
                <button type="button" className="sc-chip press" onClick={() => { hapticLight(); onOpenVolleyball(); }} data-testid="tab-volleyball-link">
                  {c.volleyball}<ArrowIcon />
                </button>
              )}
              {onOpenEquine && (
                <button type="button" className="sc-chip press" onClick={() => { hapticLight(); onOpenEquine(); }} data-testid="tab-equine-link">
                  {c.equine}<ArrowIcon />
                </button>
              )}
            </div>
          </div>

          {/* The sport's clip: as a preview of where the app is going (skeleton and figures drawn on it, illustrations, not
              measures), or as filmed, with nothing read from it. */}
          <section className="sc-section sports-hero" data-testid="sports-demo-player-card" data-reveal style={{ '--i': 4 }}>
            <div className="sports-name-row">
              <h2 className="sc-name">{sp.name}</h2>
              {view === 'preview' ? <PreviewTag fr={fr} /> : <DemoTag fr={fr} />}
            </div>
            <div className="sc-chips sports-view" role="group" aria-label={c.viewLabel}>
              <button type="button" className="sc-chip press" aria-pressed={view === 'preview'} onClick={() => { hapticLight(); setView('preview'); }} data-testid="sports-view-preview">{c.viewPreview}</button>
              <button type="button" className="sc-chip press" aria-pressed={view === 'raw'} onClick={() => { hapticLight(); setView('raw'); }} data-testid="sports-view-raw">{c.viewRaw}</button>
            </div>
            <div className="sc-frame">
              <video key={`${activeSport}-${view}`} ref={muteVideo} src={view === 'preview' ? previewUrl(activeSport) : clipUrl(activeSport)} controls playsInline muted loop autoPlay={!reduced} preload="metadata" className="sports-demo-video" data-testid="sports-demo-player" />
            </div>
            <p className="sc-frame-note is-quiet" data-testid="sports-demo-note">{view === 'preview' ? c.previewNote : `${sp.clip} ${c.demoNote}`}</p>
          </section>

          {/* Golf only: the putt as filmed, with its credit (CC BY-SA asks for the author and the licence). It does not play
              on its own: the swing above already does. */}
          {activeSport === 'golf' && (
            <section className="sc-section" data-testid="sports-putt-card">
              <div className="sc-head">
                <h2 className="sc-head-title">{c.puttHead}</h2>
                <span className="sc-head-tags"><DemoTag fr={fr} /></span>
              </div>
              <div className="sc-frame">
                <video ref={muteVideo} src={PUTT_URL} poster={PUTT_POSTER_URL} controls playsInline muted preload="metadata" className="sports-demo-video" data-testid="sports-putt-video" />
              </div>
              <p className="sc-frame-note is-quiet" data-testid="sports-putt-note">{c.puttClip} {c.demoNote}</p>
              <p className="sc-caption sports-credit" data-testid="sports-putt-credit">
                {c.puttAuthor} · <a href={PUTT_LICENSE_URL} target="_blank" rel="noreferrer" data-testid="sports-putt-license-link">{c.puttLicense}</a> · <a href={PUTT_FILE_PAGE} target="_blank" rel="noreferrer" data-testid="sports-putt-credit-link">{c.puttFilePage}</a>
              </p>
            </section>
          )}

          {/* What a phone video could measure once built, and what it cannot, with the reason. */}
          <section className="sc-section sports-reach" data-testid="sports-reach">
            <div className="sc-card">
              <div className="sc-card-top">
                <h3 className="sports-card-title">{c.laterHead}</h3>
                <span className="sc-tag">{c.laterTag}</span>
              </div>
              <ul className="sports-list">{sp.later.map(t => <li key={t}>{t}</li>)}</ul>
            </div>
            <div className="sc-card">
              <h3 className="sports-card-title">{c.neverHead}</h3>
              <ul className="sports-list is-never">{sp.never.map(t => <li key={t}>{t}</li>)}</ul>
            </div>
          </section>

          {(activeSport === 'golf' || activeSport === 'rowing') && <RatioCalc key={activeSport} kind={activeSport} c={c} fr={fr} />}
        </div>
      </section>
    </div>
  );
}
