// Anonymous, aggregate usage counts (analytics, 3 October 2026).
// POST /event adds one to a daily count per (day, event, lift, tier, duration bucket, app version, language). Nothing
// else is kept: no IP, no user id, no time finer than the day, no row per event. The rate limit keys on a hash of the
// IP salted with a secret and the day; that hash lives at most three minutes in its own table (a job every minute
// deletes it, purgeRateKeys, worker.js scheduled) and is never written beside a count. GET /stats and GET /dashboard
// read the counts with the STATS_TOKEN secret, sent in the Authorization header; the dashboard's form posts it.
import { validEvent, MAX_BATCH, EVENT_NAMES, DURATION_BUCKETS } from './usage-schema.js';

const MAX_BODY = 4096;
// Events accepted per IP hash per minute. A visit sends about a dozen; 120 lets a busy gym's shared Wi-Fi through and
// stops a script. Status: convention (UNSOURCED), not measured.
export const USAGE_RATE_MAX = 120;

// Without a RATE_SALT secret, a salt made when the worker starts and kept only in its memory: two copies of the worker
// then hash one IP differently, which weakens the limit and never the privacy.
let isolateSalt = null;
function memorySalt() {
  if (!isolateSalt) {
    const b = new Uint8Array(16);
    crypto.getRandomValues(b);
    isolateSalt = Array.from(b, x => x.toString(16).padStart(2, '0')).join('');
  }
  return isolateSalt;
}

async function sha256Hex(text) {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, '0')).join('');
}

export const utcDay = (now = new Date()) => now.toISOString().slice(0, 10);

/** The rate-limit key of an IP on a day: salted, one-way, different every day. */
export async function rateKey(env, ip, day) {
  return (await sha256Hex(`${env.RATE_SALT || memorySalt()}:${day}:${ip}`)).slice(0, 24);
}

/**
 * Deletes the rate-limit hashes of every minute before the last one. Run by each event (overRate) and, so a hash is
 * deleted even when no event follows, by the worker's job every minute (worker.js, scheduled; wrangler.toml, crons):
 * a hash written in minute m is gone by the first run in minute m + 2, so within three minutes, whatever the traffic.
 */
export async function purgeRateKeys(env, nowMs = Date.now()) {
  await env.DB.prepare('DELETE FROM usage_rate WHERE minute < ?').bind(Math.floor(nowMs / 60000) - 1).run();
}

/** Adds `hits` to the key's count for this minute, drops minutes older than the last one, and says if over the limit. */
export async function overRate(env, key, hits, nowMs = Date.now()) {
  const minute = Math.floor(nowMs / 60000);
  await purgeRateKeys(env, nowMs);
  await env.DB.prepare(
    'INSERT INTO usage_rate (key, minute, hits) VALUES (?, ?, ?) ON CONFLICT(key, minute) DO UPDATE SET hits = hits + excluded.hits'
  ).bind(key, minute, hits).run();
  const row = await env.DB.prepare('SELECT hits FROM usage_rate WHERE key = ? AND minute = ?').bind(key, minute).first();
  return !!row && row.hits > USAGE_RATE_MAX;
}

/** The events of a request body: one event, or { events: [...] } with 1 to MAX_BATCH events. Null when malformed. */
export function parseEvents(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  let list;
  if ('events' in body) {
    if (Object.keys(body).length !== 1 || !Array.isArray(body.events)) return null;
    list = body.events;
  } else list = [body];
  if (list.length < 1 || list.length > MAX_BATCH) return null;
  const out = list.map(validEvent);
  return out.every(Boolean) ? out : null;
}

/** Adds the events to their daily counts. */
export async function addCounts(env, events, day) {
  const counts = new Map();
  for (const e of events) {
    const k = JSON.stringify([e.event, e.lift, e.tier, e.durationBucket, e.appVersion, e.lang]);
    counts.set(k, (counts.get(k) || 0) + 1);
  }
  const sql = `INSERT INTO usage_daily (day, event, lift, tier, duration_bucket, app_version, lang, count)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(day, event, lift, tier, duration_bucket, app_version, lang) DO UPDATE SET count = count + excluded.count`;
  const statements = [...counts].map(([k, n]) => env.DB.prepare(sql).bind(day, ...JSON.parse(k), n));
  if (typeof env.DB.batch === 'function') await env.DB.batch(statements);
  else for (const s of statements) await s.run();
}

const json = (data, status = 200, extra = {}) => new Response(JSON.stringify(data), {
  status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...extra },
});

/** POST /event. The body is read as text, so the app can send it as text/plain with no preflight. */
export async function handleEvent(request, env, cors, now = new Date()) {
  const length = Number(request.headers.get('content-length'));
  if (length > MAX_BODY) return json({ error: 'Payload too large' }, 413, cors);
  const text = await request.text();
  if (text.length > MAX_BODY) return json({ error: 'Payload too large' }, 413, cors);
  let body;
  try { body = JSON.parse(text); } catch { return json({ error: 'Invalid JSON' }, 400, cors); }
  const events = parseEvents(body);
  if (!events) return json({ error: 'Invalid event' }, 422, cors);
  const day = utcDay(now);
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  if (await overRate(env, await rateKey(env, ip, day), events.length, now.getTime())) {
    return json({ error: 'Rate limit exceeded' }, 429, { 'Retry-After': '60', ...cors });
  }
  await addCounts(env, events, day);
  return new Response(null, { status: 204, headers: cors });
}

/** True when `given` is the STATS_TOKEN. Compared in constant time on digests. Closed when no token of 16+ is set. */
export async function tokenMatches(env, given) {
  const expected = env.STATS_TOKEN;
  if (!expected || expected.length < 16 || typeof given !== 'string' || !given) return false;
  const [a, b] = await Promise.all([sha256Hex(given), sha256Hex(expected)]);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * True when the request carries the STATS_TOKEN in `Authorization: Bearer <token>`, and only there. A ?token= in the
 * address is refused since 3 October (review finding N6): an address is kept in the browser's history, its sync and
 * proxy and access logs, a header is not.
 */
export async function authorised(request, env) {
  const header = request.headers.get('Authorization') || '';
  return header.startsWith('Bearer ') && tokenMatches(env, header.slice(7));
}

/** The daily counts of the last `days` days (1 to 366), today included. */
export async function readCounts(env, days, now = new Date()) {
  const from = utcDay(new Date(now.getTime() - (days - 1) * 86400000));
  const { results } = await env.DB.prepare(
    `SELECT day, event, lift, tier, duration_bucket AS durationBucket, app_version AS appVersion, lang, count
     FROM usage_daily WHERE day >= ? ORDER BY day DESC, event, lift, app_version, lang`
  ).bind(from).all();
  return { from, to: utcDay(now), rows: results || [] };
}

const daysParam = url => {
  const d = Number(url.searchParams.get('days') || 30);
  return Number.isInteger(d) && d >= 1 && d <= 366 ? d : 30;
};

export async function handleStats(request, env, now = new Date()) {
  if (!(await authorised(request, env))) return json({ error: 'Unauthorized' }, 401);
  return json(await readCounts(env, daysParam(new URL(request.url)), now));
}

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// The dashboard's columns: a heading and the events it adds up.
const DAY_COLUMNS = [
  ['Opens', ['open']],
  ['Lift chosen', ['choose_lift']],
  ['Video chosen', ['film_start']],
  ['Analyses started', ['analysis_start']],
  ['Counted', ['analysis_done']],
  ['Not counted (asked)', ['analysis_uncounted']],
  ['Refused', ['analysis_refused']],
  ['Failed, partial or interrupted', ['analysis_failed', 'analysis_partial', 'analysis_interrupted']],
  ['Cancelled', ['analysis_cancelled']],
  ['Kept', ['result_kept']],
  ['Corrected', ['result_corrected']],
  ['Reports', ['report_open']],
  ['Shares', ['share']],
];
const LIFT_COLUMNS = DAY_COLUMNS.filter(([, ev]) => !ev.includes('open'));

function table(head, rows) {
  return `<table><thead><tr>${head.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${
    rows.length ? rows.map(r => `<tr>${r.map((c, i) => `<td${i ? ' class="n"' : ''}>${esc(c)}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${head.length}">No data yet.</td></tr>`
  }</tbody></table>`;
}

/** The dashboard's HTML for the counts read by readCounts. */
export function dashboardHtml({ from, to, rows }) {
  const sum = (filter, events) => rows.filter(r => events.includes(r.event) && filter(r)).reduce((n, r) => n + r.count, 0);
  const days = [...new Set(rows.map(r => r.day))].sort().reverse();
  const daily = days.map(d => [d, ...DAY_COLUMNS.map(([, ev]) => sum(r => r.day === d, ev))]);
  const lifts = [...new Set(rows.filter(r => r.lift).map(r => r.lift))];
  const byLift = lifts.map(l => {
    const tier = rows.find(r => r.lift === l && r.tier)?.tier || '';
    return [l, tier, ...LIFT_COLUMNS.map(([, ev]) => sum(r => r.lift === l, ev))];
  }).sort((a, b) => b[2] - a[2] || a[0].localeCompare(b[0]));
  const sessions = DURATION_BUCKETS.map(b => [`${b} min`, sum(r => r.durationBucket === b, ['session_end'])]);
  const versions = [...new Set(rows.filter(r => r.event === 'open').map(r => `${r.appVersion}\u0000${r.lang}`))]
    .map(k => { const [v, lang] = k.split('\u0000'); return [v, lang, sum(r => r.appVersion === v && r.lang === lang, ['open'])]; })
    .sort((a, b) => b[2] - a[2]);
  const unknown = rows.filter(r => !EVENT_NAMES.includes(r.event)).length;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex"><title>WorkoutVision usage</title>
<style>body{font:14px/1.4 system-ui,sans-serif;margin:16px;background:#fff;color:#111}@media (prefers-color-scheme:dark){body{background:#111;color:#eee}th,td{border-color:#333!important}}
h1{font-size:20px}h2{font-size:16px;margin-top:28px}.wrap{overflow-x:auto}table{border-collapse:collapse;font-variant-numeric:tabular-nums}
th,td{border-bottom:1px solid #ddd;padding:4px 8px;text-align:left;white-space:nowrap}.n{text-align:right}p{max-width:60em}</style></head><body>
<h1>WorkoutVision usage, ${esc(from)} to ${esc(to)} (UTC days)</h1>
<p>Anonymous daily counts of events, as the app sends them: no person can be told from another, so these are counts of events, not of people. A visit sends one Open.${unknown ? ` ${unknown} rows have an event this worker no longer lists.` : ''}</p>
<h2>By day</h2><div class="wrap">${table(['Day', ...DAY_COLUMNS.map(([h]) => h)], daily)}</div>
<h2>By lift, over the period</h2><div class="wrap">${table(['Lift', 'Tier', ...LIFT_COLUMNS.map(([h]) => h)], byLift)}</div>
<h2>Visit length</h2><div class="wrap">${table(['Length', 'Visits'], sessions)}</div>
<h2>Opens by version and language</h2><div class="wrap">${table(['Version', 'Language', 'Opens'], versions)}</div>
<p>Raw counts: GET /stats?days=${esc(String(Math.round((Date.parse(to) - Date.parse(from)) / 86400000) + 1))} with the same token in an Authorization: Bearer header.</p>
</body></html>`;
}

/** The dashboard's sign-in form: the token is posted in the body, never put in the address (review finding N6). */
export function tokenFormHtml(wrong = false) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex"><title>WorkoutVision usage</title>
<style>body{font:16px/1.4 system-ui,sans-serif;margin:16px;background:#fff;color:#111}@media (prefers-color-scheme:dark){body{background:#111;color:#eee}}
label{display:block;margin:12px 0 4px}input{font:inherit;padding:8px;width:100%;max-width:24em;box-sizing:border-box}button{font:inherit;margin-top:16px;padding:8px 16px}</style></head><body>
<h1>WorkoutVision usage</h1>${wrong ? '\n<p role="alert">Wrong token.</p>' : ''}
<form method="post" action="/dashboard">
<label for="token">Token (STATS_TOKEN)</label><input id="token" name="token" type="password" autocomplete="current-password" required>
<label for="days">Days</label><input id="days" name="days" type="number" min="1" max="366" value="30">
<button type="submit">Show the counts</button>
</form></body></html>`;
}

const HTML_HEADERS = {
  'Content-Type': 'text/html; charset=utf-8',
  'Cache-Control': 'no-store',
  // The form posts only to this worker; no page may frame it.
  'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
  'Referrer-Policy': 'no-referrer',
  'X-Robots-Tag': 'noindex',
};
const MAX_FORM = 1024;

/**
 * GET /dashboard with the token in the Authorization header (curl), or, in a browser, GET /dashboard for the form
 * and POST /dashboard with the form's token and days (application/x-www-form-urlencoded). Without a valid token, the
 * form, with 401.
 */
export async function handleDashboard(request, env, now = new Date()) {
  let ok = false, days = daysParam(new URL(request.url)), tried = false;
  if (request.method === 'POST') {
    const type = request.headers.get('Content-Type') || '';
    const text = type.startsWith('application/x-www-form-urlencoded') && Number(request.headers.get('content-length') || 0) <= MAX_FORM ? await request.text() : '';
    const form = new URLSearchParams(text.length <= MAX_FORM ? text : '');
    tried = true;
    ok = await tokenMatches(env, form.get('token') || '');
    const d = Number(form.get('days') || 30);
    days = Number.isInteger(d) && d >= 1 && d <= 366 ? d : 30;
  } else ok = await authorised(request, env);
  if (!ok) return new Response(tokenFormHtml(tried), { status: 401, headers: HTML_HEADERS });
  return new Response(dashboardHtml(await readCounts(env, days, now)), { headers: HTML_HEADERS });
}
