#!/usr/bin/env node
/**
 * Compares the iPhone's copied « Run all 15 » JSON payload from check.html against the
 * computer's read (Chromium where it decodes, macOS WebKit where it does not) across all
 * 15 DEMO_CLIPS and writes test/real-phone/iphone-read/table.md.
 *
 * Exits 0 only when every clip of DEMO_CLIPS has a valid iPhone read, a valid computer
 * read, and matching counts; exits 1 when any clip disagrees, is missing, or fails to decode.
 *
 * Usage:
 *   node scripts/iphone-read-table.mjs <phone.json> [--computer <computer.json>] [--out <table.md>]
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEMO_CLIPS } from '../src/lib/check.js';

const DEFAULT_COMPUTER_PATH = resolve('test/real-phone/iphone-read/computer.json');
const DEFAULT_OUT_PATH = resolve('test/real-phone/iphone-read/table.md');

/** Index a flat entry list or `{ results }` payload by clip id. */
function indexResults(payload) {
  const list = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.results)
      ? payload.results
      : Array.isArray(payload?.clips)
        ? payload.clips
        : null;
  if (!list) return null;
  const map = new Map();
  for (const entry of list) {
    if (entry && typeof entry.id === 'string') map.set(entry.id, entry);
  }
  return map;
}

/** Validate and index a computer payload (split `{ chromium, webkit }` or flat entry list). */
function normalizeComputerPayload(computerPayload) {
  if (computerPayload && (Object.hasOwn(computerPayload, 'chromium') || Object.hasOwn(computerPayload, 'webkit'))) {
    const chromMap = Object.hasOwn(computerPayload, 'chromium') ? indexResults(computerPayload.chromium) : new Map();
    const webkitMap = Object.hasOwn(computerPayload, 'webkit') ? indexResults(computerPayload.webkit) : new Map();
    if ((Object.hasOwn(computerPayload, 'chromium') && !chromMap)
      || (Object.hasOwn(computerPayload, 'webkit') && !webkitMap)) {
      throw new Error('Computer payload `chromium` and `webkit` entries must each contain a `results` array.');
    }
    return { split: true, chromMap, webkitMap };
  }
  const flatMap = indexResults(computerPayload);
  if (!flatMap) {
    throw new Error('Computer payload must be `{ chromium, webkit }`, an object with `results`, or an array of clip entries.');
  }
  return { split: false, flatMap };
}

/** Pick the computer entry for one clip: Chromium when it decodes, else macOS WebKit. */
function selectComputerEntry(clipId, indexedComputer) {
  if (indexedComputer.split) {
    const chrom = indexedComputer.chromMap.get(clipId) ?? null;
    if (chrom && !chrom.notDecodable) {
      return { browser: 'Chromium', entry: chrom };
    }
    const wk = indexedComputer.webkitMap.get(clipId) ?? null;
    if (wk) {
      return { browser: 'macOS WebKit', entry: wk };
    }
    if (chrom) {
      return { browser: 'Chromium', entry: chrom };
    }
    return { browser: null, entry: null };
  }
  const entry = indexedComputer.flatMap.get(clipId) ?? null;
  return { browser: entry?.browser || 'Computer', entry };
}

/** Normalize one entry's read outcome into display count, numeric value (or null), and failure reason. */
function classifyEntry(entry, sideLabel) {
  if (!entry) {
    return { numeric: null, display: sideLabel === 'computer' ? 'no read' : 'missing', reason: `missing from ${sideLabel} payload` };
  }
  if (entry.notDecodable) {
    return { numeric: null, display: sideLabel === 'computer' ? 'no read' : 'not decodable', reason: `not decodable on ${sideLabel}` };
  }
  if (entry.refused || entry.count === 'refused') {
    return { numeric: null, display: 'refused', reason: `${sideLabel} refused the set` };
  }
  if (entry.error) {
    return { numeric: null, display: sideLabel === 'computer' ? 'no read' : 'error', reason: `${sideLabel}: ${String(entry.error)}` };
  }
  if (typeof entry.count === 'number' && Number.isFinite(entry.count)) {
    return { numeric: entry.count, display: String(entry.count), reason: null };
  }
  return { numeric: null, display: sideLabel === 'computer' ? 'no read' : 'no count', reason: `${sideLabel} returned no count` };
}

function formatCoverage(entry) {
  const cov = entry?.poseCoverage ?? entry?.poseCoveragePct ?? null;
  return typeof cov === 'number' && Number.isFinite(cov) ? `${Math.round(cov)}%` : '-';
}

function formatDecoder(entry) {
  if (!entry) return '-';
  const dec = entry.decoderPath ?? entry.decoder ?? null;
  if (!dec) return '-';
  return entry.fallback ? `${dec} (${entry.fallback})` : String(dec);
}

function formatSamples(entry) {
  if (!entry) return null;
  const s = entry.samplesRead ?? entry.samples;
  return typeof s === 'number' && Number.isFinite(s) ? s : null;
}

const escapeCell = s => String(s ?? '-').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');

/**
 * Compare iPhone check.html results against computer reads across all 15 DEMO_CLIPS.
 * @param {object|Array} phonePayload
 * @param {object|Array} computerPayload
 * @param {{ phoneUserAgent?: string }} [options]
 */
export function compareDemoReads(phonePayload, computerPayload, options = {}) {
  const phoneMap = indexResults(phonePayload);
  if (!phoneMap) {
    throw new Error('iPhone payload must be a JSON object with a `results` array or an array of clip entries.');
  }

  const indexedComputer = normalizeComputerPayload(computerPayload);

  const rows = DEMO_CLIPS.map(clip => {
    const phoneEntry = phoneMap.get(clip.id) ?? null;
    const { browser: computerBrowser, entry: compEntry } = selectComputerEntry(clip.id, indexedComputer);

    const phoneState = classifyEntry(phoneEntry, 'iPhone');
    const compState = classifyEntry(compEntry, 'computer');

    const agreeBool = phoneState.numeric !== null
      && compState.numeric !== null
      && phoneState.numeric === compState.numeric;

    const reasons = [];
    if (phoneState.reason) reasons.push(phoneState.reason);
    if (compState.reason) reasons.push(compState.reason);
    if (phoneState.numeric !== null && compState.numeric !== null && phoneState.numeric !== compState.numeric) {
      reasons.push(`iPhone ${phoneState.numeric} differs from ${computerBrowser || 'computer'} ${compState.numeric}`);
    }

    return {
      id: clip.id,
      file: clip.file,
      lift: clip.lift,
      label: clip.label,
      phoneCount: phoneState.display,
      computerCount: compState.display,
      computerBrowser: computerBrowser || '-',
      agree: agreeBool ? 'yes' : 'no',
      decoder: formatDecoder(phoneEntry),
      computerDecoder: formatDecoder(compEntry),
      samplesRead: formatSamples(phoneEntry),
      computerSamplesRead: formatSamples(compEntry),
      poseCoverage: formatCoverage(phoneEntry),
      computerPoseCoverage: formatCoverage(compEntry),
      missing: !phoneEntry || !compEntry,
      notDecodable: Boolean(phoneEntry?.notDecodable || compEntry?.notDecodable),
      reason: reasons.join('; ') || '-',
    };
  });

  const agreeCount = rows.filter(r => r.agree === 'yes').length;
  const disagreeCount = rows.length - agreeCount;
  const missingCount = rows.filter(r => r.missing).length;

  return {
    generatedAt: new Date().toISOString().slice(0, 10),
    phoneUserAgent: options.phoneUserAgent || phonePayload?.userAgent || 'unknown',
    chromiumUserAgent: computerPayload?.chromium?.userAgent || null,
    webkitUserAgent: computerPayload?.webkit?.userAgent || null,
    ok: agreeCount === rows.length,
    agreeCount,
    disagreeCount,
    missingCount,
    rows,
  };
}

/** Render the comparison object to GitHub-flavored Markdown. */
export function renderIphoneReadTable(report) {
  const lines = [
    '# iPhone vs Computer Read: 15 Bundled Demo Clips',
    '',
    `Generated: ${report.generatedAt} · Agree: ${report.agreeCount} of ${report.rows.length}`,
    `iPhone User-Agent: \`${report.phoneUserAgent}\``,
  ];
  if (report.chromiumUserAgent) lines.push(`Chromium User-Agent: \`${report.chromiumUserAgent}\``);
  if (report.webkitUserAgent) lines.push(`macOS WebKit User-Agent: \`${report.webkitUserAgent}\``);
  lines.push(
    '',
    '| Clip | Lift | Label | iPhone | Computer | Agree | Decoder | Samples read | Pose coverage | Note |',
    '|---|---|---:|---:|---:|:---:|---|---:|---:|---|',
  );

  for (const r of report.rows) {
    const compCell = r.computerBrowser && r.computerBrowser !== '-'
      ? `${r.computerCount} (${r.computerBrowser})`
      : r.computerCount;
    const samplesCell = r.samplesRead === null ? '-' : String(r.samplesRead);
    lines.push(
      `| ${escapeCell(r.id)} | ${escapeCell(r.lift)} | ${r.label} | ${escapeCell(r.phoneCount)} | ${escapeCell(compCell)} | ${r.agree} | ${escapeCell(r.decoder)} | ${samplesCell} | ${escapeCell(r.poseCoverage)} | ${escapeCell(r.reason)} |`,
    );
  }
  lines.push('');
  return lines.join('\n');
}

/**
 * Read `<phone.json>` and computer JSON from disk, compare, and write `<out.md>`.
 * @param {{ phonePath: string, computerPath?: string, outPath?: string }} opts
 */
export function buildIphoneReadTable({
  phonePath,
  computerPath = DEFAULT_COMPUTER_PATH,
  outPath = DEFAULT_OUT_PATH,
}) {
  let phonePayload;
  let computerPayload;
  try {
    phonePayload = JSON.parse(readFileSync(resolve(phonePath), 'utf8'));
  } catch (err) {
    throw new Error(`Failed to parse iPhone JSON at ${phonePath}: ${err.message}`);
  }
  try {
    computerPayload = JSON.parse(readFileSync(resolve(computerPath), 'utf8'));
  } catch (err) {
    throw new Error(`Failed to parse computer baseline JSON at ${computerPath}: ${err.message}`);
  }

  const report = compareDemoReads(phonePayload, computerPayload);
  const markdown = renderIphoneReadTable(report);
  const absOut = resolve(outPath);
  mkdirSync(dirname(absOut), { recursive: true });
  writeFileSync(absOut, markdown, 'utf8');
  return { report, markdown, outPath: absOut };
}

function parseArgs(argv) {
  let phonePath = null;
  let computerPath = DEFAULT_COMPUTER_PATH;
  let outPath = DEFAULT_OUT_PATH;
  const takeValue = (flag, idx) => {
    const val = argv[idx];
    if (!val || val.startsWith('-')) throw new Error(`Missing value for ${flag}`);
    return val;
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--computer') { computerPath = takeValue('--computer', ++i); continue; }
    if (a.startsWith('--computer=')) {
      const val = a.slice('--computer='.length);
      if (!val) throw new Error('Missing value for --computer=');
      computerPath = val;
      continue;
    }
    if (a === '--out') { outPath = takeValue('--out', ++i); continue; }
    if (a.startsWith('--out=')) {
      const val = a.slice('--out='.length);
      if (!val) throw new Error('Missing value for --out=');
      outPath = val;
      continue;
    }
    if (a.startsWith('-')) throw new Error(`Unknown option: ${a}`);
    if (phonePath) throw new Error(`Unexpected extra argument: ${a}`);
    phonePath = a;
  }
  return { phonePath, computerPath, outPath };
}

const isCli = Boolean(process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url));
if (isCli) {
  let parsed;
  try {
    parsed = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(err.message || err);
    process.exit(1);
  }
  const { phonePath, computerPath, outPath } = parsed;
  if (!phonePath) {
    console.error('Usage: node scripts/iphone-read-table.mjs <phone.json> [--computer <computer.json>] [--out <table.md>]');
    process.exit(1);
  }
  try {
    const { report, outPath: written } = buildIphoneReadTable({ phonePath, computerPath, outPath });
    console.log(`Wrote ${written} (${report.agreeCount} of ${report.rows.length} clips agree).`);
    process.exit(report.ok ? 0 : 1);
  } catch (err) {
    console.error(err.message || err);
    process.exit(1);
  }
}
