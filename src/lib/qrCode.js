/**
 * Generate a branded QR-code-like SVG placeholder.
 * This is a visually convincing pattern, not a real QR encoder.
 * Replace with a real QR library (e.g. qrcode-generator) when a scannable code is needed.
 */

const MODULES = 21; // 21x21 grid (Version 1 QR size)
const QUIET_ZONE = 2;

/**
 * Generate a deterministic pseudo-random pattern from a seed string.
 */
function seededPattern(seed) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
  }
  const grid = [];
  for (let row = 0; row < MODULES; row++) {
    grid[row] = [];
    for (let col = 0; col < MODULES; col++) {
      grid[row][col] = false;
    }
  }

  // Finder patterns (three 7x7 squares in corners)
  const drawFinder = (r, c) => {
    for (let dr = 0; dr < 7; dr++) {
      for (let dc = 0; dc < 7; dc++) {
        const isOuter = dr === 0 || dr === 6 || dc === 0 || dc === 6;
        const isInner = dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4;
        grid[r + dr][c + dc] = isOuter || isInner;
      }
    }
  };
  drawFinder(0, 0);
  drawFinder(0, MODULES - 7);
  drawFinder(MODULES - 7, 0);

  // Timing patterns (alternating dots between finders)
  for (let i = 8; i < MODULES - 8; i++) {
    grid[6][i] = i % 2 === 0;
    grid[i][6] = i % 2 === 0;
  }

  // Fill data area with seeded pseudo-random
  for (let row = 0; row < MODULES; row++) {
    for (let col = 0; col < MODULES; col++) {
      // Skip finder and timing zones
      const inFinder =
        (row < 8 && col < 8) ||
        (row < 8 && col >= MODULES - 8) ||
        (row >= MODULES - 8 && col < 8);
      const inTiming = row === 6 || col === 6;
      if (inFinder || inTiming) continue;

      hash = ((hash << 5) - hash + row * 31 + col * 17) | 0;
      grid[row][col] = (Math.abs(hash) % 3) !== 0; // ~66% fill for visual density
    }
  }

  return grid;
}

/**
 * @param {object} options
 * @param {string} [options.url='https://workoutvision.app'] - URL the QR conceptually links to
 * @param {number} [options.size=200] - SVG width/height in px
 * @param {string} [options.fg='#00f5d4'] - foreground (module) color
 * @param {string} [options.bg='transparent'] - background color
 * @param {boolean} [options.branded=true] - show "WV" center logo
 * @returns {string} SVG markup string
 */
export function generateQRCodeSVG({
  url = 'https://workoutvision.app',
  size = 200,
  fg = '#00f5d4',
  bg = 'transparent',
  branded = true,
} = {}) {
  const grid = seededPattern(url);
  const totalModules = MODULES + QUIET_ZONE * 2;
  const cellSize = size / totalModules;
  const r = cellSize * 0.15; // rounded corner radius

  let rects = '';

  for (let row = 0; row < MODULES; row++) {
    for (let col = 0; col < MODULES; col++) {
      if (!grid[row][col]) continue;

      // Skip center area if branded (for logo)
      if (branded) {
        const centerStart = Math.floor(MODULES / 2) - 2;
        const centerEnd = Math.floor(MODULES / 2) + 2;
        if (row >= centerStart && row <= centerEnd && col >= centerStart && col <= centerEnd) continue;
      }

      const x = (col + QUIET_ZONE) * cellSize;
      const y = (row + QUIET_ZONE) * cellSize;
      rects += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${cellSize.toFixed(1)}" height="${cellSize.toFixed(1)}" rx="${r.toFixed(1)}" fill="${fg}"/>`;
    }
  }

  // Center brand logo
  let logo = '';
  if (branded) {
    const cx = size / 2;
    const cy = size / 2;
    const logoR = cellSize * 2.8;
    logo = `
      <circle cx="${cx}" cy="${cy}" r="${logoR}" fill="#000" stroke="${fg}" stroke-width="1.5"/>
      <text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="central"
        font-family="-apple-system,system-ui,sans-serif" font-weight="800" font-size="${cellSize * 2.2}"
        fill="${fg}">WV</text>
    `;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    ${bg !== 'transparent' ? `<rect width="${size}" height="${size}" fill="${bg}" rx="8"/>` : ''}
    ${rects}
    ${logo}
  </svg>`;
}

/**
 * Draw the QR code onto a canvas context at a given position.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x - top-left x
 * @param {number} y - top-left y
 * @param {number} size - width/height
 * @param {object} [options]
 */
export function drawQRCodeOnCanvas(ctx, x, y, size, {
  url = 'https://workoutvision.app',
  fg = '#00f5d4',
  branded = true,
} = {}) {
  const grid = seededPattern(url);
  const totalModules = MODULES + QUIET_ZONE * 2;
  const cellSize = size / totalModules;

  ctx.fillStyle = fg;

  for (let row = 0; row < MODULES; row++) {
    for (let col = 0; col < MODULES; col++) {
      if (!grid[row][col]) continue;

      if (branded) {
        const centerStart = Math.floor(MODULES / 2) - 2;
        const centerEnd = Math.floor(MODULES / 2) + 2;
        if (row >= centerStart && row <= centerEnd && col >= centerStart && col <= centerEnd) continue;
      }

      const cx = x + (col + QUIET_ZONE) * cellSize;
      const cy = y + (row + QUIET_ZONE) * cellSize;
      const r = cellSize * 0.15;

      // Rounded rect for each module
      ctx.beginPath();
      ctx.moveTo(cx + r, cy);
      ctx.lineTo(cx + cellSize - r, cy);
      ctx.quadraticCurveTo(cx + cellSize, cy, cx + cellSize, cy + r);
      ctx.lineTo(cx + cellSize, cy + cellSize - r);
      ctx.quadraticCurveTo(cx + cellSize, cy + cellSize, cx + cellSize - r, cy + cellSize);
      ctx.lineTo(cx + r, cy + cellSize);
      ctx.quadraticCurveTo(cx, cy + cellSize, cx, cy + cellSize - r);
      ctx.lineTo(cx, cy + r);
      ctx.quadraticCurveTo(cx, cy, cx + r, cy);
      ctx.closePath();
      ctx.fill();
    }
  }

  // Center brand logo
  if (branded) {
    const centerX = x + size / 2;
    const centerY = y + size / 2;
    const logoR = cellSize * 2.8;

    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(centerX, centerY, logoR, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = fg;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(centerX, centerY, logoR, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = fg;
    ctx.font = `800 ${cellSize * 2.2}px -apple-system, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('WV', centerX, centerY);
  }
}
