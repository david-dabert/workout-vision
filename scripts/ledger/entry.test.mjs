// The agent ledger's lines (entry.mjs): who each piece of work is given to, and what each GitHub event writes.
import { describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { agentOf, clip, enrich, entries, filesOf, insert, when, write } from './entry.mjs';

describe('agentOf', () => {
  it('takes an Agent trailer first, then the branch prefix, then a merge message, then Claude\'s trailer', () => {
    expect(agentOf({ branch: 'claude/x', message: 'Fix\n\nAgent: Antigravity' })).toBe('Antigravity');
    expect(agentOf({ branch: 'antigravity/screens' })).toBe('Antigravity');
    expect(agentOf({ branch: 'claude/card-025' })).toBe('Claude');
    expect(agentOf({ branch: 'main', message: 'Merge pull request #425 from david-dabert/claude/card-025-bench-asks\n\nCard 025' })).toBe('Claude');
    expect(agentOf({ branch: 'lab/x', message: 'Bench\n\nClaude-Session: https://claude.ai/code/session_1' })).toBe('Claude');
    expect(agentOf({ branch: 'main', authorEmail: 'noreply@anthropic.com' })).toBe('Claude');
  });
  it('says unattributed when nothing names an agent', () => {
    expect(agentOf({ branch: 'fix-header', message: 'Fix header', authorName: 'David' })).toBe('unattributed');
    expect(agentOf({ branch: 'claude', message: '' })).toBe('unattributed');
  });
});

describe('when and clip', () => {
  it('gives UTC with Paris time', () => {
    expect(when('2026-11-14T20:41:03Z')).toBe('2026-11-14 20:41:03 UTC (21:41 Paris)');
    expect(when('2026-07-14T20:41:03Z')).toBe('2026-07-14 20:41:03 UTC (22:41 Paris)');
  });
  it('keeps event text on one line, without links or code, cut short', () => {
    expect(clip('a\nb [x](y) `z` <i>', 200)).toBe("a b (x)(y) 'z' 'i'");
    expect(clip('x'.repeat(130)).length).toBe(120);
  });
});

const commit = (id, message, extra = {}) => ({ id, message, timestamp: '2026-11-14T18:40:00Z', url: `https://github.com/o/r/commit/${id}`, author: { name: 'Claude', email: 'noreply@anthropic.com' }, added: ['a'], modified: ['b', 'c'], removed: [], distinct: true, ...extra });

describe('push', () => {
  it('writes each new commit, newest first, with its files and link', () => {
    const lines = entries('push', { ref: 'refs/heads/claude/collect-refused', commits: [commit('c572ea45aaaa', 'Collector: keep a refused set\n\nbody'), commit('d00dd00dbbbb', 'Second', { timestamp: '2026-11-14T18:50:00Z' })], size: 2, compare: 'https://x' });
    expect(lines.map(l => l.text)).toEqual([
      'Claude · COMMIT · claude/collect-refused @ d00dd00d · "Second" · 1 added, 2 changed, 0 removed · [commit](https://github.com/o/r/commit/d00dd00dbbbb)',
      'Claude · COMMIT · claude/collect-refused @ c572ea45 · "Collector: keep a refused set" · 1 added, 2 changed, 0 removed · [commit](https://github.com/o/r/commit/c572ea45aaaa)',
    ]);
  });
  it('leaves the file counts out when GitHub sends none (the push that creates a branch)', () => {
    const [l] = entries('push', { ref: 'refs/heads/claude/new', created: true, commits: [commit('65c51731dddd', 'New', { added: [], modified: [], removed: [] })] });
    expect(l.text).toBe('Claude · COMMIT · claude/new @ 65c51731 · "New" · [commit](https://github.com/o/r/commit/65c51731dddd)');
  });
  it('writes a merge into main once, without the branch commits already recorded', () => {
    const lines = entries('push', { ref: 'refs/heads/main', commits: [commit('c572ea45aaaa', 'Collector', { distinct: false }), commit('e985a332cccc', 'Merge pull request #426 from david-dabert/claude/collect-refused\n\nCollector', { author: { name: 'David', email: 'd@x' } })], size: 2, compare: 'https://x' });
    expect(lines).toHaveLength(1);
    expect(lines[0].text).toMatch(/^Claude · COMMIT · main @ e985a332 · "Merge pull request #426/);
  });
  it('writes a force push and a direct push to main as events, with the agent', () => {
    const forced = entries('push', { ref: 'refs/heads/claude/x', forced: true, before: '1111111111', after: '2222222222', commits: [commit('2222222222', 'Redo')], compare: 'https://x' });
    expect(forced[0].text).toBe('Claude · FORCE PUSH · claude/x rewritten from 11111111 to 22222222 · [compare](https://x)');
    const direct = entries('push', { ref: 'refs/heads/main', commits: [commit('3333333333', 'Quick fix', { author: { name: 'A', email: 'a@x' } })], compare: 'https://x' });
    expect(direct[0].text).toMatch(/^unattributed · DIRECT PUSH TO MAIN, not through a pull request/);
    expect(direct[1].text).toMatch(/^unattributed · COMMIT · main/);
  });
  it('records a deleted branch and a pushed tag', () => {
    expect(entries('push', { ref: 'refs/heads/antigravity/old', deleted: true, before: 'abcdef1234', commits: [] })[0].text).toBe('Antigravity · BRANCH DELETED · antigravity/old (was abcdef12)');
    expect(entries('push', { ref: 'refs/tags/v1.5.0', after: 'abcdef1234', commits: [], head_commit: { timestamp: '2026-11-14T20:00:00Z' } })[0].text).toBe('TAG PUSHED · v1.5.0 @ abcdef12');
  });
});

describe('files changed', () => {
  it('names the files and lines the API gave, four at most', () => {
    const c = { files: ['a.js', 'b.js', 'c.js', 'd.js', 'e.js'].map(filename => ({ filename, status: 'modified' })), stats: { additions: 12, deletions: 3 } };
    expect(filesOf(c)).toBe(' · 5 files, +12 -3 lines: a.js, b.js, c.js, d.js, and 1 more');
    expect(filesOf({ files: [{ filename: 'x.md' }], stats: null })).toBe(' · 1 file: x.md');
  });
  it('asks the API for each new commit, and keeps the push\'s lists when it does not answer', async () => {
    const event = { commits: [{ id: 'aaa', distinct: true }, { id: 'bbb', distinct: false }, { id: 'ccc', distinct: true }] };
    const asked = [];
    const fetchImpl = async url => { asked.push(url); return url.endsWith('/aaa') ? { ok: true, json: async () => ({ files: [{ filename: 'f.js', status: 'added' }], stats: { additions: 1, deletions: 0 } }) } : { ok: false }; };
    await enrich('push', event, { token: 't', repo: 'o/r', fetchImpl });
    expect(asked).toEqual(['https://api.github.com/repos/o/r/commits/aaa', 'https://api.github.com/repos/o/r/commits/ccc']);
    expect(event.commits[0].files).toEqual([{ filename: 'f.js', status: 'added' }]);
    expect(event.commits[2].files).toBeUndefined();
    expect(await enrich('pull_request', { x: 1 }, { token: 't', repo: 'o/r', fetchImpl })).toEqual({ x: 1 });
  });
});

describe('pull requests, CI runs, comments', () => {
  const pr = { number: 427, html_url: 'https://github.com/o/r/pull/427', title: 'TRIED: Safari', head: { ref: 'claude/tried-safari-ci' }, base: { ref: 'main' }, created_at: '2026-11-14T19:19:04Z', merged_at: '2026-11-14T20:38:10Z', closed_at: '2026-11-14T20:38:10Z', merge_commit_sha: 'bbdbaad9ade9', merged: true };
  it('writes opened, merged and closed pull requests', () => {
    expect(entries('pull_request', { action: 'opened', pull_request: { ...pr, merged: false } })[0].text).toBe('Claude · PR OPENED · [PR #427](https://github.com/o/r/pull/427) · claude/tried-safari-ci into main · "TRIED: Safari"');
    expect(entries('pull_request', { action: 'closed', pull_request: pr })[0]).toEqual({ at: '2026-11-14T20:38:10Z', text: 'Claude · PR MERGED · [PR #427](https://github.com/o/r/pull/427) · claude/tried-safari-ci into main at bbdbaad9 · "TRIED: Safari"' });
    expect(entries('pull_request', { action: 'closed', pull_request: { ...pr, merged: false } })[0].text).toMatch(/PR CLOSED WITHOUT MERGE/);
    expect(entries('pull_request', { action: 'labeled', pull_request: pr })).toEqual([]);
  });
  it('writes a finished CI run with its result and length, and a deploy as a publication', () => {
    const run = { name: 'CI', status: 'completed', conclusion: 'failure', head_branch: 'antigravity/screens', head_sha: 'abcdef123456', event: 'pull_request', run_attempt: 1, run_started_at: '2026-11-14T20:00:00Z', updated_at: '2026-11-14T20:31:00Z', html_url: 'https://github.com/o/r/actions/runs/1', head_commit: { message: 'x' } };
    expect(entries('workflow_run', { workflow_run: run })[0].text).toBe('Antigravity · CI FAILED · CI on antigravity/screens @ abcdef12 (pull_request) · 31 min · [run](https://github.com/o/r/actions/runs/1)');
    const deploy = { ...run, name: 'Deploy to GitHub Pages', conclusion: 'success', head_branch: 'main', event: 'workflow_run', head_commit: { message: 'Merge pull request #426 from david-dabert/claude/collect-refused' } };
    expect(entries('workflow_run', { workflow_run: deploy })[0].text).toMatch(/^Claude · DEPLOYED TO PRODUCTION \(GitHub Pages\) · Deploy to GitHub Pages on main/);
    expect(entries('workflow_run', { workflow_run: { ...run, status: 'in_progress' } })).toEqual([]);
  });
  it('writes comments on #190 with their kind and agent, and warns on another account', () => {
    const c = (body, login = 'david-dabert') => ({ action: 'created', issue: { number: 190 }, comment: { body, user: { login }, created_at: '2026-11-14T20:40:00Z', html_url: 'https://github.com/o/r/issues/190#c1' } });
    expect(entries('issue_comment', c('PUBLISHED (Antigravity): landing page, workoutvision.app\n\nmore'))[0].text).toBe('Antigravity · #190 PUBLISHED · "PUBLISHED (Antigravity): landing page, workoutvision.app" · [comment](https://github.com/o/r/issues/190#c1)');
    expect(entries('issue_comment', c('Go ahead with the lanes.'))[0].text).toMatch(/^David or an unmarked agent · #190 COMMENT/);
    const other = entries('issue_comment', c('CLAIM (Claude): x', 'someone'));
    expect(other[0].text).toMatch(/^WARNING · comment on #190 by someone, not david-dabert/);
    expect(entries('issue_comment', { ...c('x'), issue: { number: 12 } })).toEqual([]);
  });
});

describe('the month file', () => {
  it('puts new lines under the header, newest first, above the older ones', () => {
    const first = insert('', '2026-11', [{ at: '2026-11-14T18:00:00Z', text: 'A' }]);
    const second = insert(first, '2026-11', [{ at: '2026-11-14T19:00:00Z', text: 'B' }, { at: '2026-11-14T20:00:00Z', text: 'C' }]);
    expect(second.startsWith('# Ledger, November 2026\n')).toBe(true);
    const items = second.split('\n').filter(l => l.startsWith('- '));
    expect(items.map(l => l.slice(-1))).toEqual(['C', 'B', 'A']);
  });
  it('writes the month file and a README in the ledger folder', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ledger-'));
    const lines = write(dir, 'pull_request', { action: 'opened', pull_request: { number: 1, html_url: 'u', title: 't', head: { ref: 'antigravity/a' }, base: { ref: 'main' }, created_at: '2026-11-14T21:00:00Z' } });
    expect(lines).toHaveLength(1);
    expect(readFileSync(join(dir, '2026-11.md'), 'utf8')).toMatch(/Antigravity · PR OPENED/);
    expect(existsSync(join(dir, 'README.md'))).toBe(true);
    expect(write(dir, 'pull_request', { action: 'labeled', pull_request: {} })).toEqual([]);
  });
});
