// jsPDF's optional modules, html2canvas, canvg and dompurify, left out of the build (C9, design review of 7 October
// 2026). jsPDF loads them only for doc.html() and addSvgAsImage(), which the app never calls (pdf-kit.js draws each
// page itself): about 380 kB of JavaScript otherwise built and precached for every phone. vite.config.js points the
// three names here; a call to either method fails at once with this message instead of drawing nothing.
function missing() { throw new Error('jsPDF html() and addSvgAsImage() are not part of this build (src/lib/jspdf-optional-stub.js)'); }
export default missing;
export const Canvg = { fromString: missing };
export const sanitize = missing;
