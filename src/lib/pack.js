/**
 * The video packer's rules (pack.html): many videos from the phone made small and put in one file with the counts
 * David gives them (David, 10 October 2026: "a tool that can compress one hundred videos from a phone very fast and
 * turn them into one file that I can give you"). Pure, so the page and its tests share them.
 *
 * Each video keeps exactly the pictures the app's own count reads: the app's sampling (extractFramesWebCodecs, 15 a
 * second from the video's first frame, 640 px on the long side, rotation applied), each picture encoded once. The
 * label is the count David types while the page shows no count of the app's: a blind count (R1).
 */
import { TARGET_FPS, MAX_LONG_SIDE } from './extractionConfig';

// Bits per pixel of each picture for the encoder's target bitrate: about 520 kbit/s at 640 x 360 and 15 pictures a
// second, about 1.9 MB for a 30-second set. Measured 10 October 2026 on David's three videos of that day, packed in
// Chromium (VP9) at 0.15, 0.3 and 0.6 and read back by the app: the median shift of the limb landmarks against the
// read of the unpacked video went 2.8 -> 2.2 -> 2.0 cm, 6.2 -> 5.2 -> 5.0 cm and 2.8 -> 2.5 -> 2.3 cm for twice and
// 3.3 times the size, and the counts moved at every level (any re-encode moves the pose read: TRIED.md, "Counts that
// swing under re-encoding"). So the smallest is kept. Source: that measurement. Status: validated on 3 videos
// (Chromium VP9; the iPhone's H.264 not measured).
export const BITS_PER_PIXEL = 0.15;
// A key picture every 2 s, so a player or a reader can seek. Source: convention. Status: convention.
export const KEY_EVERY_SEC = 2;

/** The packed picture size: the app's own (long side at most MAX_LONG_SIDE, even), as extractFramesWebCodecs sets it. */
export function packedSize(displayWidth, displayHeight, maxLongSide = MAX_LONG_SIDE) {
  let w = displayWidth, h = displayHeight;
  const long = Math.max(w, h);
  if (long > maxLongSide) {
    const k = maxLongSide / long;
    w = Math.round(w * k); h = Math.round(h * k);
    w -= w % 2; h -= h % 2;
  }
  return { width: w, height: h };
}

/** The encoder's target bitrate for a picture size, in bits per second. */
export const bitrateFor = (width, height, fps = TARGET_FPS, bpp = BITS_PER_PIXEL) => Math.round(bpp * width * height * fps);

// The codecs tried in order: H.264 (High, Main, Baseline; the iPhone's hardware encoder), then VP9 (a browser with no
// H.264 encoder, such as the test Chromium). Each with the mp4-muxer codec name it is written under.
export const ENCODER_CODECS = [
  { codec: 'avc1.640028', mux: 'avc' },
  { codec: 'avc1.4D4028', mux: 'avc' },
  { codec: 'avc1.42E028', mux: 'avc' },
  { codec: 'vp09.00.31.08', mux: 'vp9' },
];

/** The encoder configuration for a size, with the first codec `isSupported(config)` accepts; null when none. */
export async function pickEncoder(width, height, isSupported, bpp = BITS_PER_PIXEL) {
  for (const c of ENCODER_CODECS) {
    const config = {
      codec: c.codec, width, height, bitrate: bitrateFor(width, height, TARGET_FPS, bpp), framerate: TARGET_FPS,
      latencyMode: 'quality', ...(c.mux === 'avc' ? { avc: { format: 'avc' } } : {}),
    };
    try { if ((await isSupported(config))?.supported) return { config, mux: c.mux }; } catch { /* the next codec */ }
  }
  return null;
}

/**
 * The key that tells one picked file from another across reloads: its name and size, not its date, which iPhone Safari
 * sets when Photos hands the file over (batchCollect.js, sameFile; seventh review, 30 September). A copy under another
 * name is caught after packing by its fingerprint.
 */
export const fileKey = file => `${file.name}|${file.size}`;

/** The count field as typed: a whole number from 0 to 99, null when empty ("not counted"), undefined when invalid. */
export function parseCount(text) {
  const s = String(text ?? '').trim();
  if (s === '') return null;
  return /^\d{1,2}$/.test(s) ? Number(s) : undefined;
}

/** The packed video's name inside the file: its row number and exercise, so the order and the label are visible. */
export function packedName(index, lift, ext = 'mp4') {
  const n = String(index + 1).padStart(3, '0');
  return `videos/${n}-${String(lift || 'unlabelled').replace(/[^a-z0-9_]/gi, '_')}.${ext}`;
}

/** ?bpp= on the page's address: another bits-per-pixel for a measured comparison, from 0.05 to 1; else the default. */
export function bppFrom(search) {
  const v = Number(new URLSearchParams(search).get('bpp'));
  return Number.isFinite(v) && v >= 0.05 && v <= 1 ? v : BITS_PER_PIXEL;
}

/** The file's name: the date and, when there are several, which part it is. */
export function packFileName(date, part = 1, parts = 1) {
  const d = date.toISOString().slice(0, 16).replace(/[:T]/g, '-');
  return `workoutvision-pack-${d}${parts > 1 ? `-part${part}of${parts}` : ''}.zip`;
}

// What a video adds to a file beyond its own bytes: its two ZIP headers (30 + 46 bytes and its name twice) and its
// entry in the labels file. Source: the ZIP format (APPNOTE 4.3.7, 4.3.12) and labels.json as written here (about
// 1.2 kB a set, measured 10 October 2026; 2 kB kept as a margin). Status: convention.
export const ENTRY_BYTES = 76, LABEL_BYTES = 2000, FILE_BYTES = 22 + 1000;
export const entryCost = it => it.size + ENTRY_BYTES + 2 * new TextEncoder().encode(it.name ?? '').length + LABEL_BYTES;

/**
 * The videos split into files of at most `cap` bytes each (Infinity: one file), in order, the headers and labels
 * counted; a video too large for the cap on its own goes alone. Each item needs `size` and `name`.
 */
export function planParts(items, cap = Infinity) {
  const parts = [];
  let cur = [], used = FILE_BYTES;
  for (const it of items) {
    const cost = entryCost(it);
    if (cur.length && used + cost > cap) { parts.push(cur); cur = []; used = FILE_BYTES; }
    cur.push(it); used += cost;
  }
  if (cur.length) parts.push(cur);
  return parts;
}

/** The labels file of a part: labels.json alone, labels-part2of3.json in a split, so parts unzipped together keep all. */
export const labelsName = (part = 1, parts = 1) => (parts > 1 ? `labels-part${part}of${parts}.json` : 'labels.json');

/**
 * A choice made on one row carries to the rows below, packed or not (the label is read when the file is made), up to
 * the first row David worked on himself: a field chosen by hand or reps typed. Returns the rows changed.
 */
export function carryDown(rows, from, key, value) {
  const changed = [];
  for (let j = from + 1; j < rows.length; j++) {
    const r = rows[j];
    if (Object.keys(r.touched || {}).length || String(r.countText ?? '').trim() !== '') break;
    if (r.state === 'twin') continue;
    if (r[key] !== value) { r[key] = value; changed.push(r); }
  }
  return changed;
}

/**
 * labels.json of one file: what each video is, how it was made and David's label. `rows` are the packed rows:
 * { name, file: { name, size, lastModified }, sha256, lift, count, view, source, packed }.
 */
export function labelsFor(rows, { version, packedAt, part = 1, parts = 1 }) {
  return {
    note: 'Videos packed on the phone by pack.html. count: the reps David typed while the page showed no count of the app\'s (a blind count, R1); null when he left it empty. Each video holds the pictures the app\'s count reads: 15 a second from the first frame, 640 px on the long side, rotation applied, no sound.',
    version, packedAt, part, parts,
    sets: rows.map(r => ({
      video: r.name, lift: r.lift || null, count: r.count ?? null, view: r.view || null, labelKind: 'blind-pack',
      original: { name: r.file.name, size: r.file.size, lastModified: new Date(r.file.lastModified).toISOString(), sha256: r.sha256 ?? null },
      source: r.source ?? null, packed: r.packed ?? null,
    })),
  };
}

// ─── ZIP, stored (no compression: the videos are already compressed) ───

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();

/** CRC-32 (IEEE 802.3, the ZIP's) of bytes, continuing from `crc` when given. */
export function crc32(bytes, crc = 0) {
  let c = (crc ^ 0xffffffff) >>> 0;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function dosTime(date) {
  const d = new Date(Math.max(date.getTime(), Date.UTC(1980, 0, 1)));
  return {
    time: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1),
    date: ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}

// ZIP64 is not written: one file and its entries stay under 4 GB, and fewer than 65535 entries.
export const ZIP_MAX_BYTES = 0xffffffff;

/**
 * A stored ZIP as a Blob made of the entries' own Blobs (nothing is copied into memory: on an iPhone the videos stay
 * where IndexedDB keeps them). entries: [{ name, data: Blob, size, crc, date }]. Names are written as UTF-8 (flag 11).
 */
export function zipStored(entries, BlobImpl = Blob) {
  const enc = new TextEncoder();
  const parts = [], central = [];
  let offset = 0;
  for (const e of entries) {
    const name = enc.encode(e.name), { time, date } = dosTime(e.date ?? new Date());
    if (e.size > ZIP_MAX_BYTES || offset > ZIP_MAX_BYTES) throw new Error('the file would pass 4 GB: choose smaller parts');
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true); local.setUint16(4, 20, true); local.setUint16(6, 0x0800, true);
    local.setUint16(8, 0, true); local.setUint16(10, time, true); local.setUint16(12, date, true);
    local.setUint32(14, e.crc, true); local.setUint32(18, e.size, true); local.setUint32(22, e.size, true);
    local.setUint16(26, name.length, true); local.setUint16(28, 0, true);
    parts.push(local.buffer, name, e.data);
    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true);
    c.setUint16(10, 0, true); c.setUint16(12, time, true); c.setUint16(14, date, true);
    c.setUint32(16, e.crc, true); c.setUint32(20, e.size, true); c.setUint32(24, e.size, true);
    c.setUint16(28, name.length, true); c.setUint16(30, 0, true); c.setUint16(32, 0, true); c.setUint16(34, 0, true);
    c.setUint16(36, 0, true); c.setUint32(38, 0, true); c.setUint32(42, offset, true);
    central.push(c.buffer, name);
    offset += 30 + name.length + e.size;
  }
  const centralSize = central.reduce((s, p) => s + p.byteLength, 0);
  if (offset + centralSize > ZIP_MAX_BYTES || entries.length >= 0xffff) throw new Error('the file would pass 4 GB: choose smaller parts');
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(4, 0, true); end.setUint16(6, 0, true);
  end.setUint16(8, entries.length, true); end.setUint16(10, entries.length, true);
  end.setUint32(12, centralSize, true); end.setUint32(16, offset, true); end.setUint16(20, 0, true);
  return new BlobImpl([...parts, ...central, end.buffer], { type: 'application/zip' });
}

/** A text entry for zipStored (labels.json). */
export function textEntry(name, text, date = new Date(), BlobImpl = Blob) {
  const bytes = new TextEncoder().encode(text);
  return { name, data: new BlobImpl([bytes]), size: bytes.length, crc: crc32(bytes), date };
}

/** Bytes as a short size for the page: "1.9 MB". */
export const sizeText = n => (n >= 1e9 ? `${(n / 1e9).toFixed(2)} GB` : n >= 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1e3))} kB`);
