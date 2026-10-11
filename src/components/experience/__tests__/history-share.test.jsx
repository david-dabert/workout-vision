/**
 * Sending from the history (CollectHistory.jsx, ContributeHistory.jsx) through the share sheet. WebKit leaves a sheet
 * that was never answered (the person left for another app, locked the phone) pending for good and refuses every
 * later share with InvalidStateError. Both sections waited for the share to settle, and the collection took that
 * refusal for a second sheet: their Send button then did nothing, and said nothing, until the app was reloaded. As
 * Report and Replay (shareSheet.js): nothing waits on the sheet, a second tap within the window is the same tap, and
 * any refusal but the person's cancel says so and makes the next tap download.
 * No DOM here: the hooks are a minimal stand-in, so a tap calls the button's own handler.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CollectHistory from '../CollectHistory';
import ContributeHistory from '../ContributeHistory';
import { COLLECT } from '../collect-copy';
import { CONTRIBUTE } from '../contribute-copy';

const hooks = vi.hoisted(() => {
  let slots = [], i = 0, queue = [];
  const same = (a, b) => !!a && !!b && a.length === b.length && a.every((x, k) => Object.is(x, b[k]));
  return {
    reset() { slots = []; },
    begin() { i = 0; queue = []; },
    effects() { const q = queue; queue = []; q.forEach(f => f()); },
    useState(init) {
      const k = i++;
      if (!(k in slots)) slots[k] = typeof init === 'function' ? init() : init;
      return [slots[k], v => { slots[k] = typeof v === 'function' ? v(slots[k]) : v; }];
    },
    useRef(init) { const k = i++; if (!(k in slots)) slots[k] = { current: init }; return slots[k]; },
    useEffect(fn, deps) { const k = i++; if (!(k in slots) || !same(slots[k], deps)) { slots[k] = deps; queue.push(fn); } },
  };
});
vi.mock('react', async orig => ({ ...(await orig()), useState: hooks.useState, useRef: hooks.useRef, useEffect: hooks.useEffect }));
vi.mock('../../../lib/phoneCollect', () => ({
  collectOn: () => true,
  collectedFiles: async () => [new File(['{}'], 'set-1.json', { type: 'application/json' })],
  forgetCollected: async () => {},
}));
vi.mock('../../../lib/contribute', () => ({
  contributions: async () => [{ setId: 's1' }],
  contributionsFile: async () => new File(['{}'], 'contributions.json', { type: 'application/json' }),
  eraseContributions: async () => {},
  forgetContributions: async () => {},
  readChoice: () => 'yes',
  persistChoice: () => true,
}));

const named = name => Object.assign(new Error(name), { name });
const walk = (node, hit) => {
  if (Array.isArray(node)) return node.map(n => walk(n, hit)).find(Boolean);
  if (!node || typeof node !== 'object' || !node.props) return undefined;
  return hit(node) ? node : walk(node.props.children, hit);
};

function mount(Component, isSend) {
  hooks.reset();
  let tree;
  const settle = async () => {
    for (let n = 0; n < 6; n++) { hooks.begin(); tree = Component({ fr: true }); hooks.effects(); await new Promise(r => setImmediate(r)); }
  };
  return {
    settle,
    async tap(at) {
      vi.setSystemTime(at);
      walk(tree, n => n.type === 'button' && isSend(n)).props.onClick();
      await settle();
    },
    note: () => walk(tree, n => n.props.role === 'status').props.children,
  };
}

let share, downloads;
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
  vi.stubEnv('VITE_CONTRIBUTE', '1');
  downloads = 0;
  share = vi.fn();
  vi.stubGlobal('navigator', { share, canShare: () => true });
  vi.stubGlobal('document', {
    body: { appendChild() {} },
    createElement: () => ({ click() { downloads++; }, remove() {} }),
  });
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:wv');
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

const sections = [
  ['the collection', CollectHistory, n => n.props['data-testid'] === 'collect-send', COLLECT.fr],
  ['the contributions', ContributeHistory, n => n.props.children === CONTRIBUTE.fr.send, CONTRIBUTE.fr],
];

for (const [name, Component, isSend, t] of sections) {
  describe(`sending ${name} from the history`, () => {
    it('is not left dead by a sheet never answered: the refusal says so and the next tap downloads', async () => {
      share.mockReturnValueOnce(new Promise(() => {})).mockRejectedValueOnce(named('InvalidStateError'));
      const ui = mount(Component, isSend);
      await ui.settle();
      await ui.tap(0); // the sheet opens and is never answered
      await ui.tap(300); // a second tap within the window is the same tap
      expect(share).toHaveBeenCalledTimes(1);
      await ui.tap(60_000); // WebKit refuses every later share
      expect(share).toHaveBeenCalledTimes(2);
      expect(ui.note()).toBe(t.shareFailed);
      await ui.tap(61_000);
      expect(share).toHaveBeenCalledTimes(2);
      expect(downloads).toBe(1);
    });

    it('takes the person’s cancel for no failure: nothing is said and the next tap opens the sheet again', async () => {
      share.mockRejectedValueOnce(named('AbortError')).mockReturnValueOnce(new Promise(() => {}));
      const ui = mount(Component, isSend);
      await ui.settle();
      await ui.tap(0);
      expect(ui.note()).toBe('');
      await ui.tap(5_000);
      expect(share).toHaveBeenCalledTimes(2);
      expect(downloads).toBe(0);
    });
  });
}
