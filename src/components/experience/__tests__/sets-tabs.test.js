// Two tabs of the app share one storage but kept their own list of sets: a backup made in one missed the sets
// saved in the other (second audit, 3 October). A change in one tab now tells the others to read again.
import { describe, expect, it, vi } from 'vitest';
vi.mock('../../../lib/storage', () => ({ getWorkouts: async () => [{ id: 'a', exercise: 'squat', reps: 5, createdAt: 1 }], deleteWorkout: async () => {} }));
import { knownSets, loadSets, refreshSets } from '../sets';

describe('the sets list across tabs', () => {
  it('is read again when another tab changes the sets', async () => {
    await loadSets();
    expect(knownSets()).toHaveLength(1);
    const other = new BroadcastChannel('wv-sets');
    other.postMessage('changed');
    await new Promise(r => setTimeout(r, 50));
    expect(knownSets()).toBeNull();
    other.close();
  });
  it('tells the other tabs when this one changes them', async () => {
    const heard = [];
    const other = new BroadcastChannel('wv-sets');
    other.onmessage = e => heard.push(e.data);
    refreshSets();
    await new Promise(r => setTimeout(r, 50));
    expect(heard).toEqual(['changed']);
    other.close();
  });
});
