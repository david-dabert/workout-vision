import { describe, expect, it } from 'vitest';
import { filmingOrder, rowsFor, rowErrors, batchFileName, appendRows, twinOf, twinNote, oneAtATime, numbersUsed, mergeMemory } from '../batchCollect';

const f = (name, lastModified) => ({ name, lastModified });

describe('the batch collector', () => {
  it('numbers the sets in the order they were filmed, not the order they were picked', () => {
    const rows = rowsFor([f('c.mov', 3000), f('a.mov', 1000), f('b.mov', 2000)]);
    expect(rows.map(r => [r.set, r.file.name])).toEqual([[1, 'a.mov'], [2, 'b.mov'], [3, 'c.mov']]);
    expect(filmingOrder([f('b.mov', 1), f('a.mov', 1)]).map(x => x.name)).toEqual(['a.mov', 'b.mov']);
  });
  it('starts every row from the previous exercise and view, and with no count', () => {
    const rows = rowsFor([f('a.mov', 1)], { lift: 'squat', view: 'front' });
    expect(rows[0]).toMatchObject({ lift: 'squat', view: 'front', count: '', state: 'waiting' });
  });
  it('collects a row only with an exercise and a whole count from 0 to 99', () => {
    expect(rowErrors({ lift: 'squat', count: '12' })).toEqual([]);
    expect(rowErrors({ lift: 'squat', count: '0' })).toEqual([]);
    expect(rowErrors({ lift: '', count: '12' })).toEqual(['choose the exercise']);
    for (const count of ['', '1.5', '-1', '100', 'abc']) expect(rowErrors({ lift: 'squat', count })).toEqual(['enter the reps you counted (0 to 99)']);
  });
  it('leads each file name with its set number', () => {
    expect(batchFileName(7, 'squat_8_side_ab12cd34.json.gz')).toBe('set07_squat_8_side_ab12cd34.json.gz');
    expect(batchFileName(12, 'x.json.gz')).toBe('set12_x.json.gz');
  });
});

// Third review, 30 September.
describe('the batch collector keeps the user\'s own choices', () => {
  it('carries a choice only to the sets below that the user has not set by hand, nor collected', async () => {
    const { carryChoice } = await import('../batchCollect');
    const rows = rowsFor([f('a', 1), f('b', 2), f('c', 3), f('d', 4)]);
    // As the page does on a change: the row takes the value, is marked as set by hand, and carries it.
    const choose = (i, v) => { rows[i].lift = v; rows[i].touched = { ...rows[i].touched, lift: true }; carryChoice(rows, i, 'lift', v); };
    choose(0, 'curl'); rows[3].state = 'done'; rows[3].lift = 'squat';
    choose(1, 'leg_press'); choose(2, 'leg_press');
    choose(0, 'lateral_raise');
    expect(rows.map(r => r.lift)).toEqual(['lateral_raise', 'leg_press', 'leg_press', 'squat']);
  });
  it('stops at the first set chosen by hand: the sets below it follow that one', async () => {
    const { carryChoice } = await import('../batchCollect');
    const rows = rowsFor([f('a', 1), f('b', 2), f('c', 3), f('d', 4)]);
    const choose = (i, v) => { rows[i].lift = v; rows[i].touched = { ...rows[i].touched, lift: true }; carryChoice(rows, i, 'lift', v); };
    choose(0, 'curl'); choose(2, 'leg_press');
    choose(0, 'lateral_raise');
    expect(rows.map(r => r.lift)).toEqual(['lateral_raise', 'lateral_raise', 'leg_press', 'leg_press']);
  });
  it('adds a second pick after the sets already there, numbering on, keeping the collected ones', async () => {
    const { appendRows } = await import('../batchCollect');
    const first = rowsFor([f('a', 1), f('b', 2)]);
    first[0].state = 'done'; first[0].lift = 'squat'; first[1].lift = 'squat';
    const all = appendRows(first, [f('c', 3)]);
    expect(all.map(r => [r.set, r.file.name, r.state])).toEqual([[1, 'a', 'done'], [2, 'b', 'waiting'], [3, 'c', 'waiting']]);
    expect(all[2].lift).toBe('squat');
  });
});

// Fourth review, 30 September: names in the phone's numbering, IMG_999 before IMG_1000.
describe('the tie-break on names', () => {
  it('reads the numbers in file names as numbers', () => {
    expect(filmingOrder([f('IMG_1000.MOV', 5), f('IMG_999.MOV', 5)]).map(x => x.name)).toEqual(['IMG_999.MOV', 'IMG_1000.MOV']);
  });
});

// Fifth review, 30 September.
describe('the batch collector, fifth review', () => {
  it('stops a carried choice at a set whose count was typed: the user has looked at it', async () => {
    const { carryChoice } = await import('../batchCollect');
    const rows = rowsFor([f('a', 1), f('b', 2), f('c', 3)]);
    const choose = (i, v) => { rows[i].lift = v; rows[i].touched = { ...rows[i].touched, lift: true }; carryChoice(rows, i, 'lift', v); };
    choose(0, 'leg_press'); rows[1].count = '12';
    choose(0, 'hip_thrust');
    expect(rows.map(r => r.lift)).toEqual(['hip_thrust', 'leg_press', 'leg_press']);
  });
  // Sixth review: a set already collected (maybe shared) keeps its number; a later pick comes after it.
  it('never renumbers a set: a second pick is added after the sets already there', async () => {
    const { appendRows } = await import('../batchCollect');
    const first = rowsFor([f('b', 2)]); first[0].state = 'done';
    const all = appendRows(first, [f('a', 1)]);
    expect(all.map(r => [r.set, r.file.name, r.state])).toEqual([[1, 'b', 'done'], [2, 'a', 'waiting']]);
  });
  it('ignores a video picked a second time', async () => {
    const { appendRows } = await import('../batchCollect');
    const file = { name: 'a', lastModified: 1, size: 10 };
    expect(appendRows(rowsFor([file]), [{ ...file }]).length).toBe(1);
  });
});

// Sixth review, 30 September: any choice made by hand on a set protects the whole set.
describe('a set chosen by hand, on any field', () => {
  it('keeps its view when a view is carried from above, after its lift was chosen by hand', async () => {
    const { carryChoice } = await import('../batchCollect');
    const rows = rowsFor([f('a', 1), f('b', 2), f('c', 3)]);
    rows[1].lift = 'leg_press'; rows[1].touched = { lift: true }; carryChoice(rows, 1, 'lift', 'leg_press');
    rows[0].view = 'front'; rows[0].touched = { view: true }; carryChoice(rows, 0, 'view', 'front');
    expect(rows.map(r => r.view)).toEqual(['front', 'side', 'side']);
  });
  it('keeps a video picked again once, though the iPhone hands it over with a new date', async () => {
    const a = { name: 'IMG_0412.MOV', size: 10, lastModified: 1000 };
    expect(appendRows(rowsFor([a]), [{ ...a, lastModified: 2000 }])).toHaveLength(1);
  });
  it('names the collected set that holds the same video, by its fingerprint', async () => {
    const rows = rowsFor([f('a', 1), f('b', 2), f('c', 3)]);
    rows[0].state = 'done'; rows[0].sha256 = 'x';
    rows[1].state = 'done'; rows[1].sha256 = 'y'; rows[1].lift = 'squat'; rows[1].count = '8';
    expect(twinOf(rows, rows[2], 'y')).toEqual({ set: 2, lift: 'squat', count: 8 });
    expect(twinOf(rows, rows[2], 'z')).toBeUndefined();
    expect(twinOf(rows, rows[1], 'y')).toBeUndefined();
  });
  it('reports two labels for one video instead of choosing between them (R1)', async () => {
    expect(twinNote({ lift: 'squat', count: '8' }, { set: 5, lift: 'squat', count: 8 })).toBe('Same video as set 5: not kept.');
    expect(twinNote({ lift: 'squat', count: '10' }, { set: 5, lift: 'squat', count: 8 }))
      .toBe('Same video as set 5, labelled 8 reps there and 10 here: check which is right. Not kept; set 5 keeps 8.');
    expect(twinNote({ lift: 'curl', count: '8' }, { set: 5, lift: 'squat', count: 8 }))
      .toBe('Same video as set 5, labelled squat there and curl here: check which is right. Not kept; set 5 keeps squat.');
  });
  it('numbers on after a reload, from the number the page remembers', async () => {
    expect(appendRows([], [f('a', 1), f('b', 2)], 13).map(r => r.set)).toEqual([13, 14]);
    const rows = appendRows([], [f('a', 1)], 13);
    expect(appendRows(rows, [f('b', 2)], 1).map(r => r.set)).toEqual([13, 14]);
  });
  it('lets one share run at a time, and a stuck one go after a while', async () => {
    const share = oneAtATime(10000);
    expect([share.start(0), share.start(3000)]).toEqual([true, false]);
    share.end();
    expect(share.start(3100)).toBe(true);
    expect([share.start(9000), share.start(13200)]).toEqual([false, true]);
  });
  it('marks the numbers of the collected sets as used once a hand-over starts, whether or not it succeeds', async () => {
    const rows = rowsFor([f('a', 1), f('b', 2), f('c', 3)]).map(r => ({ ...r, set: r.set + 12 }));
    rows[0].state = 'done'; rows[1].state = 'done';
    expect(numbersUsed({ gen: 0, next: 1 }, rows)).toEqual({ gen: 0, next: 15 });
    expect(numbersUsed({ gen: 0, next: 20 }, rows)).toEqual({ gen: 0, next: 20 });
    expect(numbersUsed({ gen: 2, next: 1 }, [])).toEqual({ gen: 2, next: 1 });
  });
  it('joins what two tabs remember: the latest restart wins, then the higher number', async () => {
    expect(mergeMemory({ gen: 0, next: 6 }, { gen: 0, next: 3 })).toEqual({ gen: 0, next: 6 });
    // A restart in one tab is not undone by another tab that still holds the old numbers.
    expect(mergeMemory({ gen: 0, next: 13 }, { gen: 1, next: 1 })).toEqual({ gen: 1, next: 1 });
    expect(mergeMemory({ gen: 1, next: 4 }, { gen: 0, next: 13 })).toEqual({ gen: 1, next: 4 });
    expect(mergeMemory({ gen: 0, next: 6 }, null)).toEqual({ gen: 0, next: 6 });
  });
});

describe('all the counts on one line', () => {
  it('fills the sets not yet collected, in order, from whole numbers typed with spaces or commas', async () => {
    const { countsFromLine } = await import('../batchCollect');
    const rows = rowsFor([f('a', 1), f('b', 2), f('c', 3)]);
    rows[0].state = 'done'; rows[0].count = '9';
    expect(countsFromLine(rows, '8, 12')).toEqual({ counts: ['9', '8', '12'], error: null });
  });
  it('fills nothing when the line holds more or fewer counts than the sets, or anything but whole numbers from 0 to 99', async () => {
    const { countsFromLine } = await import('../batchCollect');
    const rows = rowsFor([f('a', 1), f('b', 2)]);
    expect(countsFromLine(rows, '8').error).toBe('2 sets to count, 1 count typed');
    expect(countsFromLine(rows, '8 9 10').error).toBe('2 sets to count, 3 counts typed');
    expect(countsFromLine(rows, '8 9.5').error).toBe('9.5 is not a whole number from 0 to 99');
    expect(countsFromLine(rows, '8 100').error).toBe('100 is not a whole number from 0 to 99');
    expect(countsFromLine(rows, '8 9').counts).toEqual(['8', '9']);
  });
});

describe('counts filled from the line', () => {
  it('do not stop an exercise carried from above, as a count typed on the set does', async () => {
    const { countsFromLine, carryChoice } = await import('../batchCollect');
    const rows = rowsFor([f('a', 1), f('b', 2), f('c', 3)], { lift: 'squat', view: 'side' });
    const { counts } = countsFromLine(rows, '8 10 7');
    rows.forEach((r, i) => { r.count = counts[i]; r.lineCount = true; });
    carryChoice(rows, 0, 'lift', 'bench_press');
    expect(rows.map(r => r.lift)).toEqual(['squat', 'bench_press', 'bench_press']);
  });
  it('read a comma followed by a space as a separator, and a comma inside a number as no whole count', async () => {
    const { countsFromLine } = await import('../batchCollect');
    expect(countsFromLine(rowsFor([f('a', 1), f('b', 2)]), '9,5').error).toBe('9,5 is not a whole number from 0 to 99');
    expect(countsFromLine(rowsFor([f('a', 1), f('b', 2)]), '9, 5').counts).toEqual(['9', '5']);
  });
});

import { mismatchNote, mismatchFloor, flaggedSets, MISMATCH_RANGE_DEG } from '../batchCollect';
describe('a video the app cannot count is flagged before it is shared (1 October 2026)', () => {
  it('uses the counter\'s own minimum range, so it never stands beside a count', () => {
    expect(MISMATCH_RANGE_DEG).toBe(20);
    for (const r of [11, 15, 19.9]) expect(mismatchNote(16, 'Squat', r)).toMatch(/^Check set 16: the app sees too little movement of the joint that counts Squat \(\d+°\) to count it\./);
    // Hip abduction at 30 degrees is counted, so it is not flagged (review of 1 October).
    for (const r of [20, 22, 30, 51]) expect(mismatchNote(16, 'Hip abduction', r)).toBe('');
  });
  it('says nothing when the range is unknown', () => {
    expect(mismatchNote(1, 'Curl', NaN)).toBe('');
    // A lift with its own set floor is held to it (core.ts, LiftDefinition.minRangeDeg): the prone Y raise's 10 degrees.
    expect(mismatchFloor('prone_y_raise')).toBe(10);
    expect(mismatchFloor('squat')).toBe(MISMATCH_RANGE_DEG);
    expect(mismatchNote(3, 'Prone Y raise', 12, mismatchFloor('prone_y_raise'))).toBe('');
    expect(mismatchNote(3, 'Prone Y raise', 8, mismatchFloor('prone_y_raise'))).toMatch(/^Check set 3: /);
    expect(mismatchNote(1, 'Curl', undefined)).toBe('');
  });
  it('lists only collected, flagged sets', () => {
    expect(flaggedSets([{ set: 1, state: 'done', mismatch: true }, { set: 2, state: 'done' }, { set: 3, state: 'failed', mismatch: true }])).toEqual([1]);
  });
});
