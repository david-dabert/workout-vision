// One palette for what the CSS cannot colour: the canvas (the stage's dust and figures, the replay's skeleton),
// the exported video's overlay and the PDF (C8, design review of 7 October 2026). Each value is the swatch the
// drawing code held before, moved here unchanged, and the same swatch as the CSS token named beside it
// (Entry.css, .wv-experience), so a theme changes in two places that sit side by side, never in the drawing code.
// Status: convention (colour values of the experience's design, design/SYSTEM.md; no measurement involved).

// Channels, for colours drawn at several opacities.
export const RGB = Object.freeze({
  bone: [239, 232, 220],    // --bone, --c-fg
  void: [8, 7, 6],          // --void, --c-surface
  lamp: [232, 189, 126],    // --lamp, --c-accent
  lampHi: [247, 220, 174],  // --lamp-hi
  // The particles' glow (entry-scene.js, ported from design/experience-prototype.html): a white-hot core and the
  // three dust tones, light to dark, and the bar of light under the figure.
  spark: [255, 251, 242],
  glint: [255, 240, 215],
  dustLight: [255, 238, 208],
  dustMid: [242, 198, 134],
  dustDeep: [214, 150, 76],
});

/** A CSS colour string for canvas: rgba(r,g,b,a). */
export const rgba = ([r, g, b], a) => `rgba(${r},${g},${b},${a})`;

// Solid swatches, as hex.
export const HEX = Object.freeze({
  lamp: '#E8BD7E',          // --lamp, --c-accent
  lampHi: '#F7DCAE',        // --lamp-hi
});

// The PDF's paper (pdf-kit.js, report-pdf.js, programme-pdf.js): --paper, --paper-ink, --paper-ash, --paper-rule,
// --paper-rule-2 and --paper-gold of Entry.css, and the wave's second side.
export const PAPER = Object.freeze({ paper: '#FBF7EF', ink: '#1D1812', ash: '#6B6256', rule: '#E4DCCD', rowRule: '#F0EADF', count: '#8A6630', waveBack: '#CDB68E' });
