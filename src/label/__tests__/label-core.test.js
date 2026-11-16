import { describe, expect, it } from 'vitest';
import { exportLabels, makeLabel, nextClip, progress, readLabels, saveLabel } from '../label-core';

const memory = () => { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) }; };
const clips = [{ id: 'a', lift: 'squat', file: 'fa' }, { id: 'b', lift: 'squat', file: 'fb' }, { id: 'c', lift: 'bicep_curl', file: 'fc' }];

describe('the labelling queue', () => {
  it('counts one rep per tap, sorted, and names who gave the count', () => {
    const l = makeLabel(clips[0], { verdict: 'counted', taps: [3.214, 1.2, 5], who: ' David ', at: 't' });
    expect(l).toEqual({ id: 'a', lift: 'squat', verdict: 'counted', count: 3, taps: [1.2, 3.21, 5], who: 'David', at: 't', file: 'fa' });
  });

  it('keeps no count for a clip of another lift or one that cannot be counted', () => {
    expect(makeLabel(clips[0], { verdict: 'other_lift', taps: [1, 2], who: 'D' }).count).toBeNull();
    expect(makeLabel(clips[0], { verdict: 'unusable', who: 'D' }).taps).toEqual([]);
  });

  it('refuses a label without a person', () => {
    expect(() => makeLabel(clips[0], { verdict: 'counted', taps: [1], who: '' })).toThrow();
  });

  it('never changes a label once saved (R1)', () => {
    const s = memory();
    expect(saveLabel(s, makeLabel(clips[0], { verdict: 'counted', taps: [1, 2], who: 'D' }))).toEqual({ saved: true });
    expect(saveLabel(s, makeLabel(clips[0], { verdict: 'counted', taps: [1], who: 'D' }))).toEqual({ saved: false, reason: 'already' });
    expect(readLabels(s).a.count).toBe(2);
  });

  it('offers the next clip not labelled, of one lift if asked, and the progress per lift', () => {
    const s = memory();
    saveLabel(s, makeLabel(clips[0], { verdict: 'unusable', who: 'D' }));
    const labels = readLabels(s);
    expect(nextClip(clips, labels)?.id).toBe('b');
    expect(nextClip(clips, labels, 'bicep_curl')?.id).toBe('c');
    expect(progress(clips, labels)).toEqual({ squat: { done: 1, total: 2 }, bicep_curl: { done: 0, total: 1 } });
  });

  it('exports every label with who sent them', () => {
    const s = memory();
    saveLabel(s, makeLabel(clips[1], { verdict: 'counted', taps: [2], who: 'D', at: '2' }));
    saveLabel(s, makeLabel(clips[0], { verdict: 'counted', taps: [1], who: 'D', at: '1' }));
    const e = exportLabels(readLabels(s), 'D', 'now');
    expect(e).toMatchObject({ kind: 'wv-stock-labels', version: 1, who: 'D', exportedAt: 'now' });
    expect(e.labels.map(l => l.id)).toEqual(['a', 'b']);
  });

  it('reads nothing broken as labels', () => {
    const s = memory(); s.setItem('wv_stock_labels', '{not json');
    expect(readLabels(s)).toEqual({});
  });
});
