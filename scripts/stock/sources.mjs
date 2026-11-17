// The stock clips the labelling queue offers (label.html; David, 16 November 2026: "Go ahead, build it now"), from
// three sources whose licences let a company use them: Wikimedia Commons (free licences only, filtered below),
// Pexels (Pexels License) and Pixabay (Pixabay Content License). Only each clip's address, licence and author are
// kept; no video enters the repository. The lift a clip is searched for is a guess from its search words: the person
// labelling confirms it before counting (R1: a label never comes from a title).

/** The lifts the queue searches for, with the words used. The lift keys are the app's (liftTiers.js, TIERS). */
export const QUERIES = Object.freeze({
  squat: ['squat exercise', 'bodyweight squat', 'barbell squat', 'goblet squat'],
  bicep_curl: ['bicep curl', 'dumbbell curl'],
  lateral_raise: ['lateral raise', 'dumbbell lateral raise'],
  lat_pulldown: ['lat pulldown'],
  bench_press: ['bench press'],
  hip_thrust: ['hip thrust', 'glute bridge exercise'],
  romanian_deadlift: ['romanian deadlift', 'deadlift'],
  leg_press: ['leg press'],
  overhead_press: ['overhead press', 'shoulder press'],
  push_up: ['push up exercise', 'push-ups fitness'],
  pull_up: ['pull up exercise', 'chin up exercise'],
  lunge: ['lunge exercise', 'walking lunges'],
  front_raise: ['dumbbell front raise'],
  tricep_pushdown: ['tricep pushdown', 'triceps extension'],
  seated_row: ['seated cable row', 'rowing machine exercise'],
  leg_extension: ['leg extension exercise'],
  leg_curl: ['leg curl exercise', 'hamstring curl'],
  glute_bridge: ['glute bridge exercise'],
});

// A clip shorter than this holds less than a set; longer, it is rarely one set. Status: convention (a set of 5 to 15
// reps lasts about 10 to 60 s; UNSOURCED).
export const MIN_SEC = 5;
export const MAX_SEC = 90;
// The widest file kept: enough for the pose model, light enough to stream on a phone. Status: convention.
export const MAX_WIDTH = 1920;

const keepDuration = d => Number.isFinite(d) && d >= MIN_SEC && d <= MAX_SEC;

/** Wikimedia Commons licences a company may use (free licences); anything else is left out. */
export function commonsLicenceOk(short) {
  const s = String(short || '').toLowerCase();
  return /^(cc0|public domain|pd\b|cc[ -]by(-sa)?[ -]?\d)/.test(s) && !/nc|nd/.test(s);
}

const COMMONS_BLOCK = /sexual|orgasm|fapping|doggy_style|porn|intercourse|insemination|masturbat|erotic|nude|naked|hydrothermal|memorial|fighter_wing|emergency_management|volleyball|interview|moon_watch|rowing_boat|rowing_club|rowing_in_|rowing_competition|rowing_sports|rowing_-_|man_rowing|women_rowing|scull|regatta|paddleboard|cannery_row|row_house|river_trail|front_row_seats|row_the_boat|row-ses|silikose|étalon|etalon|récup|recup|icarly|beverly_sunrise|summer_rebuild|civil_engineer|stay_ready|live_fire|protest|felony|arrest|rally/i;
const COMMONS_EXERCISE = /\b(squats?|curls?|press|deadlifts?|lunges?|push[-_ ]?ups?|pull[-_ ]?ups?|chin[-_ ]?ups?|pulldown|row|extensions?|thrusts?|bridges?|raises?|kettlebells?|dumbbells?|barbells?|muscle|strength|strengthening|fitness|workout|exercises?|gym|training|powerlifting|weightlifting|conditioning|lift|cadera)\b/i;

/** Rejects NSFW or off-topic Commons filenames while keeping exercise demonstration and training videos. */
export function commonsFileOk(page = '', file = '') {
  const raw = decodeURIComponent(`${page} ${file}`);
  if (COMMONS_BLOCK.test(raw)) return false;
  const filePart = decodeURIComponent(String(page || '').split('File:').pop() || '');
  if (filePart.length >= 4 && !COMMONS_EXERCISE.test(filePart.replace(/_/g, ' '))) return false;
  return true;
}

const strip = html => String(html || '').replace(/<[^>]*>/g, '').trim();

/** The search address of Wikimedia Commons for one query (no key needed). */
export function commonsUrl(query, limit = 50) {
  const p = new URLSearchParams({
    action: 'query', format: 'json', generator: 'search', gsrnamespace: '6', gsrlimit: String(limit),
    gsrsearch: `${query} filetype:video`, prop: 'imageinfo', iiprop: 'url|size|mime|extmetadata', origin: '*',
  });
  return `https://commons.wikimedia.org/w/api.php?${p}`;
}

/** Queue items from a Commons answer. */
export function fromCommons(json, lift, query) {
  const pages = Object.values(json?.query?.pages || {});
  const out = [];
  for (const pg of pages) {
    const ii = pg.imageinfo?.[0];
    if (!ii || !/^video\//.test(ii.mime || '')) continue;
    const meta = ii.extmetadata || {};
    const licence = meta.LicenseShortName?.value;
    if (!commonsLicenceOk(licence) || !keepDuration(ii.duration) || !ii.width || ii.width > MAX_WIDTH || !(ii.url || '').startsWith('https://upload.wikimedia.org/')) continue;
    if (!commonsFileOk(ii.descriptionurl, ii.url)) continue;
    out.push({ id: `commons-${pg.pageid}`, source: 'commons', page: ii.descriptionurl, file: ii.url, licence, author: strip(meta.Artist?.value) || 'unknown', duration: Math.round(ii.duration), width: ii.width, height: ii.height, lift, query });
  }
  return out;
}

/** The search address of Pexels for one query; the key goes in the Authorization header. */
export const pexelsUrl = (query, perPage = 40) => `https://api.pexels.com/videos/search?${new URLSearchParams({ query, per_page: String(perPage) })}`;

/** Queue items from a Pexels answer: for each video, its widest mp4 file on videos.pexels.com up to MAX_WIDTH. */
export function fromPexels(json, lift, query) {
  const out = [];
  for (const v of json?.videos || []) {
    if (!keepDuration(v.duration)) continue;
    const files = (v.video_files || []).filter(f => f.file_type === 'video/mp4' && (f.link || '').startsWith('https://videos.pexels.com/') && f.width && f.width <= MAX_WIDTH);
    if (!files.length) continue;
    const f = files.sort((a, b) => b.width - a.width)[0];
    out.push({ id: `pexels-${v.id}`, source: 'pexels', page: v.url, file: f.link, poster: v.image, licence: 'Pexels License', author: v.user?.name || 'unknown', duration: v.duration, width: f.width, height: f.height, lift, query });
  }
  return out;
}

/** The search address of Pixabay for one query; the key goes in the address, as Pixabay asks. */
export const pixabayUrl = (query, key, perPage = 50) => `https://pixabay.com/api/videos/?${new URLSearchParams({ key, q: query, per_page: String(perPage), safesearch: 'true' })}`;

/** Queue items from a Pixabay answer: its medium file, else the large one, else the small one. */
export function fromPixabay(json, lift, query) {
  const out = [];
  for (const h of json?.hits || []) {
    if (!keepDuration(h.duration)) continue;
    const f = [h.videos?.medium, h.videos?.large, h.videos?.small].find(x => x?.url && x.url.startsWith('https://cdn.pixabay.com/') && x.width <= MAX_WIDTH);
    if (!f) continue;
    out.push({ id: `pixabay-${h.id}`, source: 'pixabay', page: h.pageURL, file: f.url, poster: f.thumbnail, licence: 'Pixabay Content License', author: h.user || 'unknown', duration: h.duration, width: f.width, height: f.height, lift, query });
  }
  return out;
}

/**
 * Merges new items into a queue: an id already queued keeps its first entry (its lift and address never change once
 * someone may have counted it); a clip found under two lifts is kept once, under the first.
 */
export function mergeQueue(queue, items) {
  const seen = new Set(queue.map(q => q.id));
  const merged = [...queue];
  for (const it of items) if (!seen.has(it.id)) { seen.add(it.id); merged.push(it); }
  return merged;
}
