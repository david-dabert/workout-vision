// Safari's VideoDecoder failed after 10 samples on David's iPhone (4 October, issue #87), and the playback path then
// read 56 % of the video. A failed decoder is now replaced by a fresh one that goes on from where it stopped.
import { describe, expect, it, vi } from 'vitest';
import { withRestarts } from '../frameExtractor';

const failAt = (startFrame, origin = 0.05) => Object.assign(new Error('Video decode failed: Decoder failure'), { resume: { startFrame, origin } });

describe('a decoder that fails part-way', () => {
  it('is restarted from the sample where it stopped, with the grid origin kept', async () => {
    const run = vi.fn()
      .mockRejectedValueOnce(failAt(10))
      .mockResolvedValueOnce({ frameCount: 467 });
    const out = await withRestarts(run, { signal: null });
    expect(out).toEqual({ result: { frameCount: 467 }, restarts: 1 });
    expect(run.mock.calls[1][0]).toMatchObject({ startFrame: 10, origin: 0.05 });
  });
  it('gives up after three restarts, and when a restart makes no progress', async () => {
    const always = vi.fn((pass) => Promise.reject(failAt((pass.startFrame ?? 0) + 5)));
    await expect(withRestarts(always, {})).rejects.toThrow('Decoder failure');
    expect(always).toHaveBeenCalledTimes(4);
    const stuck = vi.fn().mockRejectedValueOnce(failAt(10)).mockRejectedValueOnce(failAt(10));
    await expect(withRestarts(stuck, {})).rejects.toThrow();
    expect(stuck).toHaveBeenCalledTimes(2);
  });
  it('never restarts on a cancel, an error of the analysis itself, or a failure with no place to resume', async () => {
    for (const err of [Object.assign(failAt(4), { name: 'AbortError' }), Object.assign(failAt(4), { fromOnFrame: true }), new Error('Codec not supported')]) {
      const run = vi.fn().mockRejectedValue(err);
      await expect(withRestarts(run, {})).rejects.toBe(err);
      expect(run).toHaveBeenCalledTimes(1);
    }
  });
});
