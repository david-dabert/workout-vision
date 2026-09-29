import { describe, it, expect } from 'vitest';
import { REPORT_EMAIL, reportEmailUrl, reportIssueUrl, challengeShare, shareChallenge } from '../reportLinks';

// Step 1 (PLAN.md, GROWTH): every result offers a report by email to pr.dabertdavid@gmail.com,
// prefilled with the lift, the app's count, the user's count, the app version and room for the
// user's own words; the same report can open a GitHub issue. No video and no landmark is attached.
const set = { lift: 'lateral_raise', liftName: 'Lateral raise', counted: 8, userCount: 10, version: '1.4.0 (366271a)' };
const mail = url => {
  expect(url.startsWith(`mailto:${REPORT_EMAIL}?`)).toBe(true);
  const q = new URLSearchParams(url.slice(url.indexOf('?') + 1).replace(/\+/g, '%2B'));
  return { subject: q.get('subject'), body: q.get('body'), keys: [...q.keys()].sort() };
};

describe('reportEmailUrl', () => {
  it('writes to pr.dabertdavid@gmail.com with the lift, both counts and the version', () => {
    const { subject, body, keys } = mail(reportEmailUrl({ ...set, fr: false }));
    expect(REPORT_EMAIL).toBe('pr.dabertdavid@gmail.com');
    expect(keys).toEqual(['body', 'subject']);
    expect(subject).toContain('Lateral raise');
    expect(body).toContain('Lift: Lateral raise (lateral_raise)');
    expect(body).toContain('Counted by the app: 8');
    expect(body).toContain('Your count: 10');
    expect(body).toContain('App version: 1.4.0 (366271a)');
  });

  it('leaves room for the user\'s own words, at the end of the message', () => {
    const { body } = mail(reportEmailUrl({ ...set, fr: false }));
    expect(body.trimEnd().endsWith('Your message:')).toBe(true);
    expect(body).toContain('No video, frame or landmark is attached.');
  });

  it('speaks French on a French phone', () => {
    const { body } = mail(reportEmailUrl({ ...set, liftName: 'Élévations latérales', fr: true }));
    expect(body).toContain('Exercice : Élévations latérales (lateral_raise)');
    expect(body).toContain('Compté par l’app : 8');
    expect(body).toContain('Votre compte : 10');
    expect(body.trimEnd().endsWith('Votre message :')).toBe(true);
  });

  it('breaks lines as mail programs expect, CR LF, and encodes every reserved character', () => {
    const url = reportEmailUrl({ ...set, liftName: 'Curl & press?', fr: false });
    expect(url).toContain('%0D%0A');
    expect(url.slice(url.indexOf('?') + 1)).not.toMatch(/[ &?](?!body=|subject=)/);
    expect(mail(url).body).toContain('Lift: Curl & press? (lateral_raise)');
  });

  it('works when the count was right', () => {
    const { body } = mail(reportEmailUrl({ ...set, userCount: 8, fr: false }));
    expect(body).toContain('Counted by the app: 8');
    expect(body).toContain('Your count: 8');
  });
});

describe('reportIssueUrl', () => {
  it('opens a new issue on this repository with the same report, and nothing else about the user', () => {
    const url = new URL(reportIssueUrl(set));
    expect(url.origin + url.pathname).toBe('https://github.com/david-dabert/workout-vision/issues/new');
    expect([...url.searchParams.keys()].sort()).toEqual(['body', 'title']);
    const title = url.searchParams.get('title'), body = url.searchParams.get('body');
    expect(title).toBe('Count report: lateral_raise, app 8, user 10');
    expect(body).toContain('Lift: Lateral raise (lateral_raise)');
    expect(body).toContain('Counted by the app: 8');
    expect(body).toContain('Your count: 10');
    expect(body).toContain('App version: 1.4.0 (366271a)');
    expect(body).toContain('No video, frame or landmark is attached.');
  });
});

describe('challengeShare', () => {
  it('holds the result and a link to the app, and nothing else', () => {
    const s = challengeShare({ liftName: 'Lateral raise', count: 10, fr: false, url: 'https://david-dabert.github.io/workout-vision/' });
    expect(Object.keys(s).sort()).toEqual(['text', 'title', 'url']);
    expect(s.text).toContain('Lateral raise: 10 reps');
    expect(s.url).toBe('https://david-dabert.github.io/workout-vision/');
    expect(s.text).not.toContain(s.url);
  });

  it('puts one rep in the singular', () => {
    expect(challengeShare({ liftName: 'Squat', count: 1, fr: false, url: 'x' }).text).toContain('Squat: 1 rep,');
    expect(challengeShare({ liftName: 'Squat', count: 1, fr: true, url: 'x' }).text).toContain('Squat : 1 répétition,');
    expect(challengeShare({ liftName: 'Squat', count: 0, fr: true, url: 'x' }).text).toContain('Squat : 0 répétition,');
  });

  it('uses no em dash', () => {
    for (const fr of [true, false]) expect(challengeShare({ liftName: 'Squat', count: 5, fr, url: 'x' }).text).not.toContain('—');
  });

  // Review of 29 September: a count the user corrected was not counted by the app, so the message
  // must not say it was.
  it('says the app counted the reps only when the user kept the app\'s count', () => {
    const kept = challengeShare({ liftName: 'Squat', count: 8, counted: 8, fr: false, url: 'x' }).text;
    expect(kept).toContain('counted by Workout Vision');
    const fixed = challengeShare({ liftName: 'Squat', count: 10, counted: 8, fr: false, url: 'x' }).text;
    expect(fixed).toContain('Squat: 10 reps');
    expect(fixed).not.toContain('counted by');
    expect(fixed).toContain('filmed with Workout Vision');
    const fr = challengeShare({ liftName: 'Squat', count: 10, counted: 8, fr: true, url: 'x' }).text;
    expect(fr).not.toContain('comptées par');
    expect(fr).toContain('filmées avec Workout Vision');
  });
});

describe('shareChallenge', () => {
  const data = { title: 't', text: 'hello', url: 'https://x/' };
  const clipboard = () => { const c = { text: null, writeText: async t => { c.text = t; } }; return c; };

  it('opens the share sheet when there is one', async () => {
    let shared = null;
    const out = await shareChallenge(data, { share: async d => { shared = d; }, clipboard: clipboard() });
    expect(out).toBe('shared');
    expect(shared).toBe(data);
  });

  it('does nothing more when the user cancels the share sheet', async () => {
    const c = clipboard();
    const out = await shareChallenge(data, { share: async () => { throw new DOMException('', 'AbortError'); }, clipboard: c });
    expect(out).toBe('cancelled');
    expect(c.text).toBeNull();
  });

  it('copies the message when the share sheet refuses it', async () => {
    for (const name of ['NotAllowedError', 'TypeError', 'DataError']) {
      const c = clipboard();
      const out = await shareChallenge(data, { share: async () => { throw new DOMException('', name); }, clipboard: c });
      expect(out).toBe('copied');
      expect(c.text).toBe('hello https://x/');
    }
  });

  it('copies the message when there is no share sheet, and says so when it cannot', async () => {
    const c = clipboard();
    expect(await shareChallenge(data, { clipboard: c })).toBe('copied');
    expect(c.text).toBe('hello https://x/');
    expect(await shareChallenge(data, {})).toBe('unavailable');
    expect(await shareChallenge(data, { clipboard: { writeText: async () => { throw new Error('denied'); } } })).toBe('unavailable');
  });
});
