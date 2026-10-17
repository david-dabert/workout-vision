import { useKeptFile } from './useKeptFile';
import { canExport } from '../experience/video-export';
import { shownAngle } from '../../lib/reference/compare';
import { GroupHead } from '../experience/Showcase';
import { attemptStill, attemptTimeAt, COLORS, exportAttemptVideo, reportMoments } from './attempt-export';
import { drawComparison } from './overlay-draw';
import { deg } from './reference-copy';

// What the patient keeps of an attempt (David, 17 October 2026): the report as a PDF and the video with the skeleton
// drawn on it, to keep, or to send to whom they choose (their physiotherapist, doctor, coach). Each file is prepared
// on a first tap and shared or opened on a second: the share sheet opens only inside a tap, and the video takes as
// long as the attempt to record (Replay.jsx does the same for a set). Nothing leaves the phone otherwise.

/** The buttons of one kept file: prepare; while making, the progress; once ready, share and open or save. */
export function KeptFile({ keep, labels, make, testId, open = false }) {
  const { made, prepare, share, sharable, shareBroke, cancel } = keep;
  return <div className="rc-keep" data-testid={testId}>
    {(made.state === 'idle' || made.state === 'failed') && <button type="button" className="rc-btn is-wide press" onClick={() => prepare(make)} data-testid={`${testId}-make`}>{labels.make}</button>}
    {made.state === 'making' && <div className="rc-progress" role="status">
      <span>{labels.making(Math.round(made.progress * 100))}</span>
      <div className="rc-bar"><i style={{ width: `${Math.round(made.progress * 100)}%` }} /></div>
      <button type="button" className="rc-link press" onClick={cancel}>{labels.cancel}</button>
    </div>}
    {made.state === 'ready' && <div className="rc-keep-ready">
      {sharable && <button type="button" className="rc-btn is-primary is-wide press" onClick={share} data-testid={`${testId}-share`}>{labels.share}</button>}
      {/* Opened in the phone's viewer (a PDF), or saved to its files (a video): seeing it, keeping it. */}
      <a className="rc-btn is-wide press" href={made.url} {...(open ? { target: '_blank', rel: 'noopener' } : { download: made.file.name })} data-testid={`${testId}-open`}>{open ? labels.open : labels.save}</a>
      <small className="rc-keep-name">{made.file.name}</small>
    </div>}
    {made.state === 'ready' && shareBroke && <p className="sc-caption" role="status">{labels.shareBroke}</p>}
    {made.state === 'failed' && <p className="rc-error" role="alert">{labels.failed(made.why)}</p>}
  </div>;
}

/**
 * The section under a comparison: the report (PDF, with still frames of the attempt) and the attempt's video with the
 * comparison drawn on it. video: the comparison's video element on screen (ref). report: lib/kine/report.js.
 */
export default function AttemptKeep({ video, result, attPose, refPose, maps, measures, names, c, report, title, lang }) {
  const pdf = useKeptFile(), film = useKeptFile();
  const verdictText = result.verdict === 'match' ? c.match : result.verdict === 'revise' ? c.revise : c.refused;
  // The report's stills: the skeletons without the angle labels, the caption under each gives the frame's own value.
  const draw = (ctx, t, W, H, u) => drawComparison(ctx, { t, w: W, h: H, u, result, attPose, refPose, maps, measures, names, refShort: c.refShort, colors: COLORS, ghost: true, labels: false });
  const recordable = result.verdict !== 'refused' && !!maps && canExport();

  const makePdf = async (onProgress, signal) => {
    // Inside the tap, before any wait: Safari on iPhone may load no frame of a video never played, and then never
    // seeks it; played and paused at once here, it has its frames for the stills.
    const v = video.current;
    if (v && v.readyState < 2) { try { v.play()?.then(() => v.pause(), () => {}); } catch { /* the stills are left out */ } }
    const stills = [];
    if (result.verdict !== 'refused' && maps && video.current) {
      const moments = reportMoments(result);
      for (const [n, m] of moments.entries()) {
        if (signal.aborted) throw new DOMException('aborted', 'AbortError');
        const j = result.joints[m.k];
        const caption = `${m.kind === 'end' ? c.keepEnd : c.keepWorst} · ${names[j.name]} ${deg(shownAngle(m.att, j.direction))} (${c.refShort} ${deg(shownAngle(m.ref, j.direction))})`;
        try {
          const s = await attemptStill(video.current, attemptTimeAt(m.ai, maps), draw);
          stills.push({ ...s, caption });
        } catch { /* a frame the phone would not give is left out */ }
        onProgress((n + 1) / (moments.length + 1));
      }
    }
    const { attemptPdf } = await import('../../lib/kine/pdf');
    const doc = attemptPdf(report, { lang, stills });
    onProgress(1);
    return new File([doc.output('blob')], `${c.keepPdfStem(report)}.pdf`, { type: 'application/pdf' });
  };
  // The video on screen is recorded as it plays: brought into view first, since Safari on iPhone stops drawing a video
  // it does not show (Replay.jsx, 4 October); the buttons are brought back into view once the file is ready.
  const makeVideo = (onProgress, signal) => {
    video.current?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
    return exportAttemptVideo({
      screen: video.current, result, attPose, refPose, maps, measures, names, refShort: c.refShort,
      text: { title, verdict: verdictText, legend: c.keepLegend }, fileStem: c.keepVideoStem(report), onProgress, signal,
    }).then(file => {
      setTimeout(() => document.querySelector('[data-testid="rc-keep-video"]')?.scrollIntoView?.({ block: 'center', behavior: 'smooth' }), 60);
      return file;
    });
  };

  const labels = {
    cancel: c.cancel, shareBroke: c.keepShareBroke,
    pdf: { make: c.keepPdfMake, making: c.keepPdfMaking, share: c.keepPdfShare, open: c.keepPdfOpen, failed: () => c.keepPdfFailed },
    video: {
      make: c.keepVideoMake, making: c.keepVideoMaking, share: c.keepVideoShare, save: c.keepVideoSave,
      failed: why => (why === 'interrupted' || why === 'stalled' || why === 'incomplete' ? c.keepVideoStopped : c.keepVideoFailed),
    },
  };
  return <section className="sc-section" data-testid="rc-keep">
    <GroupHead title={c.keepTitle} />
    <p className="sc-caption">{c.keepHint}</p>
    <KeptFile keep={pdf} make={makePdf} open testId="rc-keep-pdf" labels={{ ...labels.pdf, cancel: labels.cancel, shareBroke: labels.shareBroke }} />
    {recordable && <>
      <KeptFile keep={film} make={makeVideo} testId="rc-keep-video" labels={{ ...labels.video, cancel: labels.cancel, shareBroke: labels.shareBroke }} />
      {film.made.state === 'making' && <p className="sc-caption" role="status">{c.keepVideoWatch}</p>}
    </>}
  </section>;
}
