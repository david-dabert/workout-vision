import { describe, expect, it } from 'vitest';
import { agreedCounts, disagreements, mergeLabels } from '../labels.mjs';

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
});
