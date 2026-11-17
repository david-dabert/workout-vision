import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { agreedCounts, disagreements, mergeLabels } from '../labels.mjs';
import { buildStockManifest } from '../stream-stock.mjs';
import { splitOf } from '../../public/split.mjs';
import { stockSets } from '../../../test/real-phone/accuracy/sets.ts';

const exp = (who, labels) => ({ kind: 'wv-stock-labels', version: 1, who, labels: labels.map(l => ({ who, at: 't', lift: 'squat', file: 'f', taps: [], ...l })) });

describe('the stock labels book', () => {
  it('takes counts only from people David names', () => {
    const r = mergeLabels({ labels: [] }, exp('Mallory', [{ id: 'a', verdict: 'counted', count: 5 }]), ['David']);
    expect(r.added).toBe(0);
    expect(r.refused).toBe('Mallory');
  });

  it('appends, and never changes a person\'s first label of a clip (R1)', () => {
    let r = mergeLabels({ labels: [] }, exp('David', [{ id: 'a', verdict: 'counted', count: 5 }]), ['David']);
    r = mergeLabels(r.book, exp('david', [{ id: 'a', verdict: 'counted', count: 6 }, { id: 'b', verdict: 'unusable', count: null }]), ['David']);
    expect(r.added).toBe(1);
    expect(r.kept).toBe(1);
    expect(r.book.labels.find(l => l.id === 'a').count).toBe(5);
  });

  it('keeps two people\'s counts, and uses a clip only when they agree', () => {
    let r = mergeLabels({ labels: [] }, exp('David', [{ id: 'a', verdict: 'counted', count: 5 }, { id: 'b', verdict: 'counted', count: 8 }]), ['David', 'Azélie']);
    r = mergeLabels(r.book, exp('Azélie', [{ id: 'a', verdict: 'counted', count: 6 }, { id: 'b', verdict: 'counted', count: 8 }]), ['David', 'Azélie']);
    expect(disagreements(r.book)).toEqual([{ id: 'a', counts: [{ who: 'David', verdict: 'counted', count: 5 }, { who: 'Azélie', verdict: 'counted', count: 6 }] }]);
    expect(agreedCounts(r.book).map(l => l.id)).toEqual(['b']);
  });

  it('refuses a file that is not an export of label.html', () => {
    expect(() => mergeLabels({ labels: [] }, { labels: [] }, ['David'])).toThrow();
  });

  it('builds a streaming manifest from agreed human labels only by default, and separates build vs holdout', () => {
    const buildId = ['commons-1', 'commons-2', 'commons-3', 'commons-4'].find(id => splitOf(id) === 'build');
    const holdId = ['commons-1', 'commons-2', 'commons-3', 'commons-4'].find(id => splitOf(id) === 'holdout');
    const queue = [
      { id: buildId, lift: 'squat', file: 'https://upload.wikimedia.org/a.webm', source: 'commons', licence: 'CC0', author: 'A' },
      { id: holdId, lift: 'push_up', file: 'https://upload.wikimedia.org/b.webm', source: 'commons', licence: 'CC0', author: 'B' },
      { id: 'commons-disagreed', lift: 'squat', file: 'https://upload.wikimedia.org/c.webm', source: 'commons', licence: 'CC0', author: 'C' },
    ];
    let r = mergeLabels({ labels: [] }, exp('David', [
      { id: buildId, verdict: 'counted', count: 10 },
      { id: holdId, verdict: 'counted', count: 12 },
      { id: 'commons-disagreed', verdict: 'counted', count: 8 },
    ]), ['David', 'Azélie']);
    r = mergeLabels(r.book, exp('Azélie', [
      { id: 'commons-disagreed', verdict: 'counted', count: 9 },
    ]), ['David', 'Azélie']);

    const m = buildStockManifest(queue, r.book, { labelledOnly: true, split: 'build' });
    expect(m.sets.map(s => s.id)).toEqual([buildId]);
    expect(m.sets[0]).toMatchObject({ id: buildId, split: 'build', count: 10, lift: 'squat' });
    expect(m.skipped.map(s => s.id)).toEqual(['commons-disagreed']);
  });

  it('reads extracted stock sets for the build half and guards the held-out half unless HOLDOUT=1', () => {
    const buildId = ['commons-1', 'commons-2', 'commons-3', 'commons-4'].find(id => splitOf(id) === 'build');
    const holdId = ['commons-1', 'commons-2', 'commons-3', 'commons-4'].find(id => splitOf(id) === 'holdout');
    const root = mkdtempSync(join(tmpdir(), 'wv-stock-test-'));
    try {
      mkdirSync(join(root, 'stock', 'build'), { recursive: true });
      const book = mergeLabels({ labels: [] }, exp('David', [
        { id: buildId, lift: 'squat', verdict: 'counted', count: 7 },
        { id: holdId, lift: 'squat', verdict: 'counted', count: 9 },
      ]), ['David']).book;
      writeFileSync(join(root, 'stock', 'labels.json'), JSON.stringify(book));
      writeFileSync(join(root, 'stock', 'build', `${buildId}.json.gz`), gzipSync(JSON.stringify({
        dataset: 'stock', id: buildId, split: 'build', lift: 'squat', count: 7,
        worldLandmarks: [[], []], timestamps: [0, 0.066], visibleShare: 1, source: 'commons',
      })));
      const res = stockSets('build', root);
      expect(res.sets).toHaveLength(1);
      expect(res.sets[0]).toMatchObject({ id: buildId, lift: 'squat', label: 7, who: 'David' });
      expect(res.held).toBe(1);
      expect(() => stockSets('holdout', root)).toThrow(/HOLDOUT=1/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
