// A video drawn in the page, a different picture at every frame (MediaRecorder, VP8 in WebM), returned as base64 for
// setInputFiles. Chromium's MediaRecorder writes no duration: it is written into the file's Info element (EBML
// Duration, in milliseconds at the default timecode scale), as a phone's camera file holds one. The same recipe as
// e2e/build-flags.spec.js (chooseDrawnVideo), which hands its file to the Film screen directly.
export async function drawnWebm(page, ms = 4000) {
  return page.evaluate(async ms => {
    const c = Object.assign(document.createElement('canvas'), { width: 360, height: 640 });
    const g = c.getContext('2d');
    const rec = new MediaRecorder(c.captureStream(30), { mimeType: 'video/webm;codecs=vp8' });
    const parts = [];
    rec.ondataavailable = e => parts.push(e.data);
    let n = 0;
    const draw = () => { g.fillStyle = `hsl(${(n * 7) % 360} 60% 50%)`; g.fillRect(0, 0, 360, 640); g.fillStyle = '#fff'; g.font = '80px sans-serif'; g.fillText(String(n++), 40, 320 + (n % 50)); };
    const timer = setInterval(draw, 33);
    draw();
    const began = performance.now();
    rec.start(500);
    await new Promise(r => setTimeout(r, ms));
    const stopped = new Promise(r => { rec.onstop = r; });
    rec.stop();
    const took = performance.now() - began;
    clearInterval(timer);
    await stopped;
    const bytes = new Uint8Array(await new Blob(parts).arrayBuffer());
    const vint = (b, at) => { let len = 1; while (len <= 8 && !(b[at] & (0x80 >> (len - 1)))) len++; let v = b[at] & (0xff >> len); for (let k = 1; k < len; k++) v = v * 256 + b[at + k]; return { len, v }; };
    const idLen = b => (b >= 0x80 ? 1 : b >= 0x40 ? 2 : b >= 0x20 ? 3 : 4);
    let at = 4; const head = vint(bytes, at); at += head.len + head.v; // the EBML header
    at += 4; at += vint(bytes, at).len; // the Segment, of unknown size: its children follow
    let out = null;
    while (at < bytes.length && !out) {
      const il = idLen(bytes[at]);
      const id = [...bytes.slice(at, at + il)].map(x => x.toString(16).padStart(2, '0')).join('');
      const size = vint(bytes, at + il), body = at + il + size.len;
      if (id === '1549a966') { // Info: Duration (0x4489, an 8-byte float) appended, its size rewritten on 8 bytes
        const dur = new Uint8Array(11); dur.set([0x44, 0x89, 0x88]); new DataView(dur.buffer).setFloat64(3, took);
        const sv = new Uint8Array(8); sv[0] = 0x01; let x = size.v + 11; for (let k = 7; k >= 1; k--) { sv[k] = x & 0xff; x = Math.floor(x / 256); }
        out = new Uint8Array(await new Blob([bytes.slice(0, at + il), sv, bytes.slice(body, body + size.v), dur, bytes.slice(body + size.v)]).arrayBuffer());
      }
      at = body + size.v;
    }
    if (!out) throw new Error('no Info element in the recorded video');
    let s = '';
    for (let i = 0; i < out.length; i += 0x8000) s += String.fromCharCode(...out.subarray(i, i + 0x8000));
    return btoa(s);
  }, ms);
}
