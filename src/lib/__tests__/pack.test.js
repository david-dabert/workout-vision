import { describe, expect, it } from 'vitest';
import { crc32 as zlibCrc32 } from 'node:zlib';
import { unzipSync } from 'fflate';
import {
  packedSize, bitrateFor, pickEncoder, fileKey, parseCount, packedName, packFileName, planParts, labelsFor,
  crc32, zipStored, textEntry, sizeText, ENCODER_CODECS,
} from '../pack';

const bytesOf = async blob => new Uint8Array(await blob.arrayBuffer());

describe('the video packer', () => {
  it('packs at the size the app reads: 640 px on the long side, even, never enlarged', () => {
    expect(packedSize(1920, 1080)).toEqual({ width: 640, height: 360 });
    expect(packedSize(1080, 1920)).toEqual({ width: 360, height: 640 });
    expect(packedSize(750, 1276)).toEqual({ width: 376, height: 640 });
    expect(packedSize(404, 720)).toEqual({ width: 358, height: 640 });
    expect(packedSize(320, 240)).toEqual({ width: 320, height: 240 });
  });

  it('aims at about half a megabit a second at 640 x 360, 15 pictures a second', () => {
    expect(bitrateFor(640, 360)).toBe(518400);
  });

  it('picks H.264 first, then VP9, and says so when the browser encodes neither', async () => {
    const only = codec => async c => ({ supported: c.codec === codec });
    expect((await pickEncoder(640, 360, only('avc1.4D4028'))).config.codec).toBe('avc1.4D4028');
    expect((await pickEncoder(640, 360, only('avc1.4D4028'))).mux).toBe('avc');
    const vp9 = await pickEncoder(640, 360, only('vp09.00.31.08'));
    expect(vp9.mux).toBe('vp9');
    expect(vp9.config.avc).toBeUndefined();
    expect(await pickEncoder(640, 360, async () => ({ supported: false }))).toBeNull();
    expect(await pickEncoder(640, 360, async () => { throw new Error('no'); })).toBeNull();
    expect(ENCODER_CODECS[0].codec.startsWith('avc1')).toBe(true);
  });

  it('reads the typed count as a whole number from 0 to 99, empty as not counted', () => {
    expect(parseCount('7')).toBe(7);
    expect(parseCount(' 12 ')).toBe(12);
    expect(parseCount('0')).toBe(0);
    expect(parseCount('')).toBeNull();
    expect(parseCount(undefined)).toBeNull();
    expect(parseCount('100')).toBeUndefined();
    expect(parseCount('7.5')).toBeUndefined();
    expect(parseCount('-1')).toBeUndefined();
  });

  it('names each packed video by its row and exercise, and the file by its date and part', () => {
    expect(packedName(0, 'overhead_press')).toBe('videos/001-overhead_press.mp4');
    expect(packedName(41, '')).toBe('videos/042-unlabelled.mp4');
    expect(packedName(2, 'a/b c')).toBe('videos/003-a_b_c.mp4');
    const d = new Date('2026-10-10T11:05:00Z');
    expect(packFileName(d)).toBe('workoutvision-pack-2026-10-10-11-05.zip');
    expect(packFileName(d, 2, 5)).toBe('workoutvision-pack-2026-10-10-11-05-part2of5.zip');
    expect(fileKey({ name: 'IMG_1.MOV', size: 10, lastModified: 5 })).toBe('IMG_1.MOV|10');
    expect(fileKey({ name: 'IMG_1.MOV', size: 10, lastModified: 9 })).toBe(fileKey({ name: 'IMG_1.MOV', size: 10, lastModified: 5 }));
  });

  it('splits into files under the cap, in order, a video larger than the cap alone', () => {
    const s = n => ({ size: n });
    expect(planParts([s(10), s(10), s(10)]).length).toBe(1);
    expect(planParts([s(10), s(10), s(10)], 25).map(p => p.length)).toEqual([2, 1]);
    expect(planParts([s(30), s(5), s(5)], 25).map(p => p.map(x => x.size))).toEqual([[30], [5, 5]]);
    expect(planParts([], 25)).toEqual([]);
  });

  it('writes each set with its blind count, null when not counted', () => {
    const rows = [
      { name: 'videos/001-squat.mp4', file: { name: 'IMG_1.MOV', size: 5, lastModified: Date.UTC(2026, 9, 10) }, sha256: 'ab', lift: 'squat', count: 9, view: 'side', source: { codec: 'hvc1' }, packed: { frames: 3 } },
      { name: 'videos/002-unlabelled.mp4', file: { name: 'IMG_2.MOV', size: 6, lastModified: 0 }, lift: '', count: null, view: '' },
    ];
    const l = labelsFor(rows, { version: '1.4.0', packedAt: '2026-10-10T11:05:00.000Z' });
    expect(l.sets[0]).toMatchObject({ video: 'videos/001-squat.mp4', lift: 'squat', count: 9, view: 'side', labelKind: 'blind-pack' });
    expect(l.sets[0].original).toEqual({ name: 'IMG_1.MOV', size: 5, lastModified: '2026-10-10T00:00:00.000Z', sha256: 'ab' });
    expect(l.sets[1]).toMatchObject({ lift: null, count: null, view: null, source: null, packed: null });
    expect(l.sets[1].original.sha256).toBeNull();
    expect([l.part, l.parts]).toEqual([1, 1]);
  });

  it('computes the ZIP checksum as zlib does, also in pieces', () => {
    const a = new TextEncoder().encode('The quick brown fox jumps over the lazy dog');
    expect(crc32(a)).toBe(zlibCrc32(a));
    expect(crc32(a)).toBe(0x414fa339);
    expect(crc32(a.subarray(10), crc32(a.subarray(0, 10)))).toBe(zlibCrc32(a));
    expect(crc32(new Uint8Array(0))).toBe(0);
  });

  it('writes a stored ZIP an independent reader opens, names in UTF-8, contents unchanged', async () => {
    const video = new Uint8Array(70000).map((_, i) => (i * 31) & 0xff);
    const entries = [
      { name: 'videos/001-squat.mp4', data: new Blob([video]), size: video.length, crc: crc32(video), date: new Date(2026, 9, 10, 11, 5, 8) },
      textEntry('labels.json', JSON.stringify({ note: 'série é' })),
    ];
    const zip = await bytesOf(zipStored(entries));
    const out = unzipSync(zip);
    expect(Object.keys(out)).toEqual(['videos/001-squat.mp4', 'labels.json']);
    expect(out['videos/001-squat.mp4']).toEqual(video);
    expect(JSON.parse(new TextDecoder().decode(out['labels.json']))).toEqual({ note: 'série é' });
    expect(zip.length).toBe(30 * 2 + 46 * 2 + 22 + 2 * ('videos/001-squat.mp4'.length + 'labels.json'.length) + video.length + entries[1].size);
  });

  it('refuses a file past 4 GB rather than writing a broken one', () => {
    expect(() => zipStored([{ name: 'a', data: new Blob([]), size: 0x100000000, crc: 0 }])).toThrow(/4 GB/);
  });

  it('shows sizes the way the page prints them', () => {
    expect(sizeText(1_900_000)).toBe('1.9 MB');
    expect(sizeText(512)).toBe('1 kB');
    expect(sizeText(2_340_000_000)).toBe('2.34 GB');
  });
});
