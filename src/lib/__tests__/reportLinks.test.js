import { describe, it, expect } from 'vitest';
import { REPORT_EMAIL, reportEmailUrl, reportIssueUrl, challengeShare, shareChallenge, reportFor } from '../reportLinks';

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
    expect(subject).toBe('Workout Vision: Lateral raise, the app 8, me 10');
    expect(body).toContain('Lift: Lateral raise (lateral_raise)');
    expect(body).toContain('Counted by the app: 8');
    expect(body).toContain('Counted by me: 10');
    expect(body).toContain('App version: 1.4.0 (366271a)');
  });

  it('leaves room for the user\'s own words, at the end of the message', () => {
    const { body } = mail(reportEmailUrl({ ...set, fr: false }));
    expect(body.trimEnd().endsWith('My message:')).toBe(true);
    expect(body).toContain('This message contains no video and no image.');
  });

  // David's copy of 29 September: the user writes to David, in the first person.
  it('speaks French on a French phone, in the user\'s own voice', () => {
    const { subject, body } = mail(reportEmailUrl({ ...set, liftName: 'Élévations latérales', fr: true }));
    expect(body).toContain('Exercice : Élévations latérales (lateral_raise)');
    expect(body).toContain('Compté par l’app : 8');
    expect(body).toContain('Compté par moi : 10');
    expect(subject).toBe('Workout Vision : Élévations latérales, l’app 8, moi 10');
    expect(body).toContain('Ce message ne contient ni vidéo ni image.');
    expect(body).not.toMatch(/Votre|vous/);
    expect(body.trimEnd().endsWith('Mon message :')).toBe(true);
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
    expect(body).toContain('Counted by me: 8');
  });
});

// Verifier of 29 September: every result offers the report, a refused one and one whose save failed included.
describe('the report of a refused set', () => {
  it('says the app counted nothing and leaves the user\'s count for them to write', () => {
    const { subject, body } = mail(reportEmailUrl({ ...set, counted: null, userCount: null, fr: false }));
    expect(subject).toBe('Workout Vision: Lateral raise, the app none, me?');
    expect(body).toContain('Counted by the app: none, the set was refused');
    expect(body).toMatch(/Counted by me: \r\n/);
    expect(body).not.toContain('null');
  });

  it('does so in French, and on GitHub', () => {
    const { subject, body } = mail(reportEmailUrl({ ...set, liftName: 'Squat', counted: null, userCount: null, fr: true }));
    expect(subject).toBe('Workout Vision : Squat, l’app rien, moi ?');
    expect(body).toContain('Compté par l’app\u00A0: rien, la série a été refusée');
    const issue = new URL(reportIssueUrl({ ...set, counted: null, userCount: null }));
    expect(issue.searchParams.get('title')).toBe('Count report: lateral_raise, set refused');
    expect(issue.searchParams.get('body')).toContain('Counted by the app: none, the set was refused');
    expect(issue.searchParams.get('body')).not.toContain('null');
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
    expect(body).toContain('Counted by me: 10');
    expect(body).toContain('App version: 1.4.0 (366271a)');
    expect(body).toContain('This message contains no video and no image.');
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
    // The app neither filmed (the video may come from the library) nor counted nor analysed the
    // corrected 10: the message gives both numbers (reviews of 29 September).
    expect(fixed).toBe('Squat: 10 reps (Workout Vision counted 8 on my phone). Can you beat it?');
    const fr = challengeShare({ liftName: 'Squat', count: 10, counted: 8, fr: true, url: 'x' }).text;
    expect(fr).toBe('Squat\u00A0: 10 répétitions (Workout Vision en a compté 8 sur mon téléphone). Vous relevez le défi\u00A0?');
    for (const t of [fixed, fr]) expect(t).not.toMatch(/filmed|filmées|analysed|analysées/);
  });
});

// Which report a result offers (Result.jsx): every result, a refused one and one whose save failed
// included (verifier and review of 29 September).
describe('reportFor', () => {
  const base = { lift: 'squat', liftName: 'Squat', count: 8, trueN: 10, version: 'v', fr: false };
  it('offers the refused set\'s report on a refused result', () => {
    expect(reportFor({ ...base, refused: true })).toEqual({ lift: 'squat', liftName: 'Squat', counted: null, userCount: null, version: 'v', fr: false });
  });
  it('offers the count\'s report once the set is saved, or when its save failed, and not before', () => {
    expect(reportFor({ ...base, step: 'saved' })).toMatchObject({ counted: 8, userCount: 10 });
    expect(reportFor({ ...base, step: 'ask', saveError: 'x' })).toMatchObject({ counted: 8, userCount: 10 });
    expect(reportFor({ ...base, step: 'fix', saveError: 'x' })).toMatchObject({ counted: 8, userCount: 10 });
    expect(reportFor({ ...base, step: 'ask' })).toBeNull();
    expect(reportFor({ ...base, step: 'fix' })).toBeNull();
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

// 29 September: the report states the decoder and the share of the video read (David's order).
describe('the report names the decoder and what was read', () => {
  const body = url => decodeURIComponent(url.split('&body=')[1]);
  it('French, a partial read: no count, the decoder and 181 of 439', () => {
    const b = body(reportEmailUrl({ lift: 'lateral_raise', liftName: 'Élévations latérales', counted: null, partial: true, userCount: null, fr: true, decoder: 'rvfc', read: { read: 181, expected: 439 } }));
    expect(b).toContain('Compté par l’app : rien, la vidéo n’a pas été lue en entier');
    expect(b).toContain('Décodeur : rvfc');
    expect(b).toContain('Vidéo lue : 181 échantillons sur 439 (41 %)');
  });
  it('English, a whole read', () => {
    const b = body(reportEmailUrl({ lift: 'squat', liftName: 'Squat', counted: 8, userCount: 8, fr: false, decoder: 'webcodecs', read: { read: 439, expected: 439 } }));
    expect(b).toContain('Decoder: webcodecs');
    expect(b).toContain('Video read: 439 of 439 samples (100%)');
  });
});

describe('review 01 of the decoder fix', () => {
  it('the GitHub title of a partial read does not say the set was refused', () => {
    const title = new URL(reportIssueUrl({ lift: 'squat', counted: null, userCount: null, partial: true })).searchParams.get('title');
    expect(title).not.toContain('refused');
    expect(title).toContain('not read in full');
  });
  it('a read with more samples than the video holds gives no share', () => {
    const b = decodeURIComponent(reportEmailUrl({ lift: 'squat', counted: null, partial: true, userCount: null, fr: true, decoder: 'rvfc après échec de webcodecs', read: { read: 481, expected: 439 } }).split('&body=')[1]);
    expect(b).toContain('Vidéo lue : 481 échantillons sur 439');
    expect(b).not.toContain('110');
  });
});
