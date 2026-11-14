// The agent ledger (David's request of 14 November 2026): one Markdown line for each fact GitHub records about the
// repository, a commit pushed, a pull request opened or merged, a CI run finished, a deploy, a comment on issue #190,
// written by .github/workflows/ledger.yml on the branch `ledger`, one file a month, newest first. Who did what, and when,
// is then read from GitHub's own records, not from an agent's account of its work.
//
//   node scripts/ledger/entry.mjs                  prints this event's lines (GITHUB_EVENT_NAME, GITHUB_EVENT_PATH)
//   node scripts/ledger/entry.mjs --write <dir>    adds them to <dir>/<YYYY-MM>.md, the ledger branch checked out there
//
// Nothing here runs text from the event: titles, messages and comments are written as text, on one line, cut short.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const AGENTS = { claude: 'Claude', antigravity: 'Antigravity' };
const ISSUE = 190;
const DEPLOY = 'Deploy to GitHub Pages';

/**
 * Which agent a piece of work belongs to, from the strongest sign to the weakest: an `Agent:` trailer in the commit
 * message, the branch prefix (claude/, antigravity/), the branch named in a merge commit's message, Claude's session
 * trailer or address, an author name naming Antigravity. Otherwise 'unattributed', which the ledger shows as such.
 */
export function agentOf({ branch = '', message = '', authorName = '', authorEmail = '' } = {}) {
  const trailer = /^Agent:\s*([A-Za-z][\w -]*)\s*$/mi.exec(message);
  if (trailer) return AGENTS[trailer[1].trim().toLowerCase()] ?? trailer[1].trim();
  const merged = /^Merge pull request #\d+ from [^/\s]+\/(\S+)/m.exec(message);
  for (const b of [branch, merged?.[1] ?? '']) {
    const prefix = b.split('/')[0].toLowerCase();
    if (AGENTS[prefix] && b.includes('/')) return AGENTS[prefix];
  }
  if (/^Claude-Session:/m.test(message) || /noreply@anthropic\.com/i.test(authorEmail)) return 'Claude';
  if (/antigravity/i.test(authorName) || /antigravity/i.test(authorEmail)) return 'Antigravity';
  return 'unattributed';
}

/** "2026-11-14 20:41:03 UTC (21:41 Paris)". */
export function when(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  const paris = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(d);
  return `${d.toISOString().slice(0, 19).replace('T', ' ')} UTC (${paris} Paris)`;
}

/** Text from the event, on one line, without Markdown that could break the list, at most n characters. */
export function clip(text, n = 120) {
  const one = String(text ?? '').replace(/\s+/g, ' ').replace(/[`<>]/g, "'").replace(/\[/g, '(').replace(/\]/g, ')').trim();
  return one.length > n ? `${one.slice(0, n - 1)}…` : one;
}

const short = sha => String(sha ?? '').slice(0, 8);
const subject = message => String(message ?? '').split('\n')[0];
const branchOf = ref => String(ref ?? '').replace(/^refs\/(heads|tags)\//, '');
const minutes = (a, b) => {
  const s = (new Date(b) - new Date(a)) / 1000;
  return Number.isFinite(s) && s >= 0 ? (s < 120 ? `${Math.round(s)} s` : `${Math.round(s / 60)} min`) : '';
};

/**
 * What a commit changed: its files and lines when the API gave them (enrich, below), else the push's own lists, else
 * nothing (Actions' push events carry empty lists, and no count is better than a false 0).
 */
export function filesOf(c) {
  if (Array.isArray(c.files)) {
    const names = c.files.map(f => clip(f.filename, 70));
    const shown = names.slice(0, 4).join(', ') + (names.length > 4 ? `, and ${names.length - 4} more` : '');
    const lines = c.stats ? `, +${c.stats.additions ?? 0} -${c.stats.deletions ?? 0} lines` : '';
    return ` · ${names.length} file${names.length === 1 ? '' : 's'}${lines}: ${shown}`;
  }
  const [a, m, r] = [c.added, c.modified, c.removed].map(x => (Array.isArray(x) ? x.length : 0));
  return a + m + r > 0 ? ` · ${a} added, ${m} changed, ${r} removed` : '';
}

/**
 * Adds each pushed commit's files and line counts from the GitHub API (GET /repos/{repo}/commits/{sha}), at most 20
 * commits; a commit the API does not answer for keeps what the push gave. Returns the event.
 */
export async function enrich(eventName, event, { token, repo, fetchImpl = globalThis.fetch } = {}) {
  if (eventName !== 'push' || !token || !repo || !Array.isArray(event.commits)) return event;
  for (const c of event.commits.slice(0, 20)) {
    if (c.distinct === false) continue;
    try {
      const res = await fetchImpl(`https://api.github.com/repos/${repo}/commits/${c.id}`, { headers: { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json' } });
      if (!res.ok) continue;
      const d = await res.json();
      if (Array.isArray(d.files)) { c.files = d.files.map(f => ({ filename: f.filename, status: f.status })); c.stats = d.stats ?? null; }
    } catch { /* the line keeps what the push gave */ }
  }
  return event;
}

/** The lines of one push: a warning for a force push or a direct push to main, then each commit, newest first. */
function pushLines(e) {
  const ref = e.ref ?? '';
  const name = branchOf(ref);
  const at = e.head_commit?.timestamp ?? (e.repository?.pushed_at ? new Date(e.repository.pushed_at * 1000).toISOString() : new Date().toISOString());
  const lines = [];
  if (ref.startsWith('refs/tags/')) {
    lines.push({ at, text: `${e.deleted ? 'TAG DELETED' : 'TAG PUSHED'} · ${clip(name, 80)} @ ${short(e.after)}` });
    return lines;
  }
  if (e.deleted) return [{ at: new Date().toISOString(), text: `${agentOf({ branch: name })} · BRANCH DELETED · ${clip(name, 80)} (was ${short(e.before)})` }];
  // Commits already pushed to another branch (distinct: false) were recorded then: a merge into main lists its merge
  // commit, not the branch's commits a second time.
  const all = Array.isArray(e.commits) ? e.commits : [];
  const commits = all.filter(c => c.distinct !== false);
  const isMerge = c => /^Merge pull request #\d+/.test(c.message ?? '');
  for (const c of [...commits].reverse()) {
    const who = agentOf({ branch: name, message: c.message, authorName: c.author?.name, authorEmail: c.author?.email });
    const files = filesOf(c);
    lines.push({ at: c.timestamp ?? at, text: `${who} · COMMIT · ${clip(name, 60)} @ ${short(c.id)} · "${clip(subject(c.message))}"${files} · [commit](${c.url})` });
  }
  const more = Number(e.size ?? all.length) - all.length;
  if (more > 0) lines.push({ at, text: `${agentOf({ branch: name })} · ${more} more commits in this push on ${clip(name, 60)} · [compare](${e.compare})` });
  if (!e.created && commits.length === 0 && !e.forced) lines.push({ at, text: `${agentOf({ branch: name })} · PUSH · ${clip(name, 60)} moved to ${short(e.after)}` });
  if (e.created && commits.length === 0) lines.push({ at, text: `${agentOf({ branch: name })} · BRANCH CREATED · ${clip(name, 60)} at ${short(e.after)}` });
  if (name === 'main' && all.length && !all.some(isMerge)) {
    lines.unshift({ at, text: `WARNING · DIRECT PUSH TO MAIN, not a pull request merge (R6) · [compare](${e.compare})` });
  }
  if (e.forced) lines.unshift({ at, text: `WARNING · FORCE PUSH on ${clip(name, 60)} (R5) · ${short(e.before)} to ${short(e.after)} · [compare](${e.compare})` });
  return lines;
}

function pullLines(e) {
  const pr = e.pull_request ?? {};
  const who = agentOf({ branch: pr.head?.ref ?? '' });
  const head = `${clip(pr.head?.ref ?? '', 60)} into ${clip(pr.base?.ref ?? '', 30)}`;
  const link = `[PR #${pr.number}](${pr.html_url})`;
  const title = `"${clip(pr.title)}"`;
  switch (e.action) {
    case 'opened': return [{ at: pr.created_at, text: `${who} · PR OPENED · ${link} · ${head} · ${title}${pr.draft ? ' · draft' : ''}` }];
    case 'reopened': return [{ at: pr.updated_at, text: `${who} · PR REOPENED · ${link} · ${title}` }];
    case 'ready_for_review': return [{ at: pr.updated_at, text: `${who} · PR READY FOR REVIEW · ${link} · ${title}` }];
    case 'converted_to_draft': return [{ at: pr.updated_at, text: `${who} · PR BACK TO DRAFT · ${link} · ${title}` }];
    case 'closed': return pr.merged
      ? [{ at: pr.merged_at, text: `${who} · PR MERGED · ${link} · ${head} at ${short(pr.merge_commit_sha)} · ${title}` }]
      : [{ at: pr.closed_at, text: `${who} · PR CLOSED WITHOUT MERGE · ${link} · ${title}` }];
    default: return [];
  }
}

function runLines(e) {
  const r = e.workflow_run ?? {};
  if (r.status !== 'completed') return [];
  const who = agentOf({ branch: r.head_branch ?? '', message: r.head_commit?.message ?? '' });
  const result = { success: 'PASSED', failure: 'FAILED', cancelled: 'CANCELLED', timed_out: 'TIMED OUT', skipped: 'SKIPPED', action_required: 'WAITING FOR APPROVAL', neutral: 'NEUTRAL', startup_failure: 'FAILED TO START' }[r.conclusion] ?? String(r.conclusion ?? '').toUpperCase();
  const what = r.name === DEPLOY
    ? (r.conclusion === 'success' ? 'DEPLOYED TO PRODUCTION (GitHub Pages)' : `DEPLOY ${result}`)
    : `CI ${result}`;
  const took = minutes(r.run_started_at, r.updated_at);
  return [{ at: r.updated_at, text: `${who} · ${what} · ${clip(r.name, 60)} on ${clip(r.head_branch ?? '', 60)} @ ${short(r.head_sha)} (${r.event}${r.run_attempt > 1 ? `, attempt ${r.run_attempt}` : ''})${took ? ` · ${took}` : ''} · [run](${r.html_url})` }];
}

function commentLines(e) {
  if (e.action !== 'created' || e.issue?.number !== ISSUE || e.issue?.pull_request) return [];
  const c = e.comment ?? {};
  const first = String(c.body ?? '').split('\n').find(l => l.trim()) ?? '';
  const named = /\((Claude|Antigravity)\)/i.exec(first);
  const who = named ? AGENTS[named[1].toLowerCase()] : (c.user?.login === 'david-dabert' ? 'David or an unmarked agent' : clip(c.user?.login, 40));
  const kind = /^\s*(CLAIM|REPORT|MERGED|PUBLISHED|DECISION|DONE)\b/i.exec(first)?.[1]?.toUpperCase() ?? 'COMMENT';
  const lines = [{ at: c.created_at, text: `${who} · #${ISSUE} ${kind} · "${clip(first, 140)}" · [comment](${c.html_url})` }];
  if (c.user?.login && c.user.login !== 'david-dabert') lines.unshift({ at: c.created_at, text: `WARNING · comment on #${ISSUE} by ${clip(c.user.login, 40)}, not david-dabert: ignored by every agent (R15)` });
  return lines;
}

/** The ledger lines of one GitHub event, each { at: ISO time, text }. */
export function entries(eventName, event) {
  switch (eventName) {
    case 'push': return pushLines(event);
    case 'pull_request': case 'pull_request_target': return pullLines(event);
    case 'workflow_run': return runLines(event);
    case 'issue_comment': return commentLines(event);
    default: return [];
  }
}

export const HEADER = (month) => {
  const d = new Date(`${month}-01T00:00:00Z`);
  const name = d.toLocaleString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  return `# Ledger, ${name}\n\nWritten by \`.github/workflows/ledger.yml\` from GitHub's own records, never by an agent. Newest first. Times in UTC, with Paris time. README.md says how each line is attributed.\n\n`;
};

/** The month file's text with the lines added under its header, newest first. */
export function insert(existing, month, lines) {
  const header = HEADER(month);
  // The lines under the header; a header worded otherwise (an older version) ends at its second blank line.
  const body = !existing ? '' : existing.startsWith(header) ? existing.slice(header.length)
    : existing.startsWith('# Ledger') ? existing.slice(existing.indexOf('\n\n', existing.indexOf('\n\n') + 2) + 2) : existing;
  const fresh = [...lines].sort((a, b) => String(b.at).localeCompare(String(a.at))).map(l => `- ${when(l.at)} · ${l.text}`).join('\n');
  return `${header}${fresh}\n${body}`;
}

export const README = `# Agent ledger

What happened in this repository, and when: one line for each commit pushed, pull request opened, merged or closed, CI run finished, deploy, and comment on issue #190. The lines are written by \`.github/workflows/ledger.yml\` on this branch from GitHub's own event records. No agent writes here, so a line is a fact, not a claim. One file a month (\`2026-11.md\`), newest first.

How a line names who did the work, strongest sign first:
1. a line \`Agent: Claude\` or \`Agent: Antigravity\` at the end of the commit message;
2. the branch prefix: \`claude/\` or \`antigravity/\` (a merge into main takes its pull request's branch);
3. Claude's \`Claude-Session:\` trailer or its noreply@anthropic.com address;
4. otherwise \`unattributed\`, shown as such.

A comment on #190 names its agent in its first line, as \`CLAIM (Antigravity)\`, \`REPORT (Claude)\`, \`PUBLISHED (Antigravity)\`. Work done outside GitHub (a page published, a store listing, a setting changed) appears here only through such a comment: \`PUBLISHED (Antigravity): what, where, link\`.

Warnings: a force push (R5), a direct push to main that is not a pull request merge (R6), a comment on #190 by an account other than david-dabert (R15).
`;

/** Adds this event's lines to <dir>/<YYYY-MM>.md (and README.md when missing); returns the lines written. */
export function write(dir, eventName, event) {
  const lines = entries(eventName, event).filter(l => l.text);
  if (!lines.length) return [];
  const newest = lines.map(l => new Date(l.at)).filter(d => !Number.isNaN(d.getTime())).sort((a, b) => b - a)[0] ?? new Date();
  const month = newest.toISOString().slice(0, 7);
  const file = join(dir, `${month}.md`);
  writeFileSync(file, insert(existsSync(file) ? readFileSync(file, 'utf8') : '', month, lines));
  const readme = join(dir, 'README.md');
  if (!existsSync(readme)) writeFileSync(readme, README);
  return lines;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const name = process.env.GITHUB_EVENT_NAME ?? '';
  const event = await enrich(name, JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH ?? '/dev/null', 'utf8') || '{}'), { token: process.env.GH_TOKEN, repo: process.env.GITHUB_REPOSITORY });
  const i = process.argv.indexOf('--write');
  const lines = i > 0 ? write(process.argv[i + 1], name, event) : entries(name, event);
  for (const l of lines) console.log(`- ${when(l.at)} · ${l.text}`);
  if (!lines.length) console.log(`(nothing to record for ${name})`);
}
