// Rules 7 and 8 of PLAN.md, checked on every shot of the tour instead of by eye.

/**
 * Rule 8: a shot never shows a blank stage or a white, unstyled page.
 * `probe` is a page of its own browser context, so the app's page is left alone.
 * Measured on the four tours of 26 September: every frame showing a screen has a
 * contrast (standard deviation of the luma, 0 to 255) of at least 14; the one blank
 * frame, the bare star field, 1.1. The brightest screen, the report and its paper
 * sheet, averages 116; an unstyled page, black text on white, is far above 180.
 */
export async function frameFault(probe, jpeg) {
  const { mean, sd } = await probe.evaluate(async b64 => {
    const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    const image = await createImageBitmap(new Blob([bytes], { type: 'image/jpeg' }));
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const g = canvas.getContext('2d');
    g.drawImage(image, 0, 0);
    const d = g.getImageData(0, 0, image.width, image.height).data;
    let sum = 0, squares = 0;
    for (let i = 0; i < d.length; i += 4) {
      const y = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      sum += y;
      squares += y * y;
    }
    const n = d.length / 4, mean = sum / n;
    return { mean, sd: Math.sqrt(Math.max(0, squares / n - mean * mean)) };
  }, jpeg.toString('base64'));
  if (sd < 4) return `blank frame (contrast ${sd.toFixed(1)})`;
  if (mean > 180) return `white or unstyled frame (brightness ${mean.toFixed(0)})`;
  return null;
}

/**
 * Rule 7, measured in the page (run with page.evaluate): no title or button leaves
 * a single word on its own line; no text overlaps other text or a control, or runs
 * out of its box; no screen scrolls sideways. Only what is on screen counts: text
 * scrolled or clipped out of view is left out, and text in a sticky or fixed layer
 * (the share bar) is compared only with text of the same layer, since it is meant
 * to pass over the content. Returns one line per fault.
 */
export function layoutFaults() {
  const faults = [];
  const root = document.querySelector('.wv-current') || document.body;
  const vw = document.documentElement.clientWidth, vh = window.innerHeight;
  const style = e => getComputedStyle(e);
  const shown = el => {
    for (let e = el; e && e !== document.documentElement; e = e.parentElement) {
      const s = style(e);
      if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) === 0) return false;
    }
    return true;
  };
  const label = el => (el.getAttribute('aria-label') || el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60);
  const isWord = s => /[\p{L}\p{N}]/u.test(s);
  const inter = (a, b) => ({ left: Math.max(a.left, b.left), right: Math.min(a.right, b.right), top: Math.max(a.top, b.top), bottom: Math.min(a.bottom, b.bottom) });
  const area = r => Math.max(0, r.right - r.left) * Math.max(0, r.bottom - r.top);
  // The part of a box left visible by the viewport and by every ancestor that clips.
  const visiblePart = (el, box) => {
    let r = inter(box, { left: 0, top: 0, right: vw, bottom: vh });
    for (let e = el; e && e !== document.documentElement; e = e.parentElement) {
      const s = style(e);
      if (s.overflowX !== 'visible' || s.overflowY !== 'visible') r = inter(r, e.getBoundingClientRect());
    }
    return area(r) > 0 ? r : null;
  };
  // The layer an element scrolls with: its closest sticky or fixed ancestor.
  const layer = el => {
    for (let e = el; e && e !== root.parentElement; e = e.parentElement) {
      const p = style(e).position;
      if (p === 'sticky' || p === 'fixed') return e;
    }
    return root;
  };
  // The block a text node sets in: its closest ancestor that is not inline.
  const blockOf = node => {
    let e = node.parentElement;
    while (e && e !== root && (style(e).display === 'inline' || style(e).display === 'contents')) e = e.parentElement;
    return e;
  };

  // Every word on screen, with its line, grouped by the block it sets in.
  const blocks = new Map();
  const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let t; (t = walk.nextNode());) {
    if (!t.data.trim() || !shown(t.parentElement)) continue;
    const block = blockOf(t);
    if (!block) continue;
    for (const m of t.data.matchAll(/\S+/g)) {
      const range = document.createRange();
      range.setStart(t, m.index);
      range.setEnd(t, m.index + m[0].length);
      const box = range.getClientRects()[0];
      if (!box || box.width === 0) continue;
      if (!blocks.has(block)) blocks.set(block, []);
      blocks.get(block).push({ text: m[0], box, el: t.parentElement });
    }
  }
  const lineHeight = el => { const v = parseFloat(style(el).lineHeight); return Number.isFinite(v) ? v : null; };
  const texts = [];
  for (const [block, words] of blocks) {
    const lines = [];
    for (const w of words) {
      const b = w.box, line = lines.find(l => Math.min(l.bottom, b.bottom) - Math.max(l.top, b.top) > Math.min(l.bottom - l.top, b.bottom - b.top) / 2);
      if (line) {
        line.words.push(w.text);
        line.left = Math.min(line.left, b.left); line.right = Math.max(line.right, b.right);
        line.top = Math.min(line.top, b.top); line.bottom = Math.max(line.bottom, b.bottom);
      } else lines.push({ words: [w.text], left: b.left, right: b.right, top: b.top, bottom: b.bottom });
    }
    lines.sort((a, b) => a.top - b.top);
    const onScreen = lines.filter(l => visiblePart(block, l));
    if (!onScreen.length) continue;

    // A title or a button leaving one word alone on its last line.
    // Guide exercise names (.item-btn) come from a database and cannot be text-wrapped.
    if (block.closest('h1, h2, h3, .title, button, [role="button"], .btn-primary') && root.contains(block)
      && !block.closest('.item-btn')
      && lines.length > 1 && lines.at(-1).words.filter(isWord).length === 1) {
      faults.push(`one word alone on the last line: "${label(block)}"`);
    }
    // Text running out of its box, sideways, when the box does not clip it.
    const s = style(block), box = block.getBoundingClientRect();
    if (s.overflowX === 'visible') {
      for (const l of onScreen) {
        if (l.right > box.right + 1 || l.left < box.left - 1) { faults.push(`text runs out of its box: "${label(block)}"`); break; }
      }
    }
    // Lines as tall as their line-height, so that tight titles do not count as overlaps.
    const lh = lineHeight(block);
    for (const l of onScreen) {
      const h = lh ? Math.min(lh, l.bottom - l.top) : l.bottom - l.top, mid = (l.top + l.bottom) / 2;
      texts.push({ block, layer: layer(block), rect: visiblePart(block, { left: l.left, right: l.right, top: mid - h / 2, bottom: mid + h / 2 }) });
    }
  }
  // A control counts where it can be seen: a transparent layer that only catches
  // taps (the entry's "show without waiting") has no outline for text to overlap.
  const drawn = c => {
    const s = style(c), clear = v => v === 'transparent' || /rgba\(.*,\s*0\)$/.test(v);
    const border = ['Top', 'Right', 'Bottom', 'Left'].some(k => parseFloat(s[`border${k}Width`]) > 0 && !clear(s[`border${k}Color`]));
    return border || !clear(s.backgroundColor) || s.backgroundImage !== 'none' || s.boxShadow !== 'none'
      || c.textContent.trim() !== '' || !!c.querySelector('svg, img') || c.matches('input, textarea, select');
  };
  const controls = [...root.querySelectorAll('button, [role="button"], input:not([type="hidden"]):not(.hx), textarea, select, a[href]')]
    .filter(c => shown(c) && drawn(c))
    .map(c => ({ el: c, layer: layer(c), rect: visiblePart(c, c.getBoundingClientRect()) }))
    .filter(c => c.rect);
  const overlaps = (a, b) => { const r = inter(a, b); return r.right - r.left > 2 && r.bottom - r.top > 2; };
  const seen = new Set();
  const report = text => { if (!seen.has(text)) { seen.add(text); faults.push(text); } };
  for (let i = 0; i < texts.length; i++) {
    const a = texts[i];
    if (!a.rect) continue;
    for (let j = i + 1; j < texts.length; j++) {
      const b = texts[j];
      if (!b.rect || a.block === b.block || a.layer !== b.layer || a.block.contains(b.block) || b.block.contains(a.block)) continue;
      if (overlaps(a.rect, b.rect)) report(`text overlaps text: "${label(a.block)}" and "${label(b.block)}"`);
    }
    for (const c of controls) {
      if (c.layer !== a.layer || c.el.contains(a.block) || a.block.contains(c.el)) continue;
      if (overlaps(a.rect, c.rect)) report(`text overlaps a control: "${label(a.block)}" and "${label(c.el)}"`);
    }
  }
  // A screen that scrolls sideways.
  for (const e of [document.documentElement, ...document.querySelectorAll('.wv-current .wv-experience')]) {
    if (e.scrollWidth > e.clientWidth + 1) report(`the screen scrolls sideways (${e.scrollWidth} px for ${e.clientWidth})`);
  }
  return faults;
}
