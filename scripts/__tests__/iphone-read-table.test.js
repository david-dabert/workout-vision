import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { DEMO_CLIPS, formatDemoEntry } from '../../src/lib/check.js';
import {
  buildIphoneReadTable,
  compareDemoReads,
  renderIphoneReadTable,
} from '../iphone-read-table.mjs';

const makeEntry = (clip, overrides = {}) => formatDemoEntry(clip, {
  count: clip.label,
  samplesRead: 300,
  decoderPath: 'webcodecs',
  poseCoverage: 98,
  exact: true,
  refused: false,
  error: false,
  notDecodable: false,
  ...overrides,
});

const makeComputerPayload = (overridesById = {}) => ({
  chromium: {
    userAgent: 'HeadlessChrome/153',
    results: DEMO_CLIPS.map(clip => {
      if (clip.file.startsWith('iphone/')) {
        return makeEntry(clip, { count: null, samplesRead: 0, decoderPath: 'rvfc', poseCoverage: null, notDecodable: true, exact: false, ...(overridesById[clip.id]?.chromium || {}) });
      }
      return makeEntry(clip, { decoderPath: 'webcodecs', ...(overridesById[clip.id]?.chromium || {}) });
    }),
  },
  webkit: {
    userAgent: 'Version/26.6 Safari/605.1.15',
    results: DEMO_CLIPS.map(clip => makeEntry(clip, {
      decoderPath: 'webcodecs',
      ...(overridesById[clip.id]?.webkit || {}),
    })),
  },
});

const makePhonePayload = (overridesById = {}, omitIds = new Set()) => ({
  userAgent: 'iPhone OS 26_1 Mobile Safari/604.1',
  delegate: 'CPU',
  poseMode: 'image',
  results: DEMO_CLIPS
    .filter(clip => !omitIds.has(clip.id))
    .map(clip => makeEntry(clip, overridesById[clip.id] || {})),
});

describe('scripts/iphone-read-table.mjs', () => {
  it('marks all 15 clips agreeing (exit 0) when phone and computer counts match', () => {
    const phone = makePhonePayload({
      demo_dip_13: { count: 12, samplesRead: 317, decoderPath: 'webcodecs', poseCoverage: 100 },
    });
    const computer = makeComputerPayload({
      demo_dip_13: { chromium: { count: 12, samplesRead: 317, poseCoverage: 100 } },
    });

    const report = compareDemoReads(phone, computer);
    expect(report.rows).toHaveLength(DEMO_CLIPS.length);
    expect(report.ok).toBe(true);
    expect(report.agreeCount).toBe(DEMO_CLIPS.length);
    expect(report.disagreeCount).toBe(0);
    expect(report.missingCount).toBe(0);

    const dipRow = report.rows.find(r => r.id === 'demo_dip_13');
    expect(dipRow).toMatchObject({
      label: 13,
      phoneCount: '12',
      computerCount: '12',
      computerBrowser: 'Chromium',
      agree: 'yes',
      decoder: 'webcodecs',
      samplesRead: 317,
      poseCoverage: '100%',
    });

    const movRow = report.rows.find(r => r.id === 'demo_iphone_dip_13');
    expect(movRow.computerBrowser).toBe('macOS WebKit');
    expect(movRow.agree).toBe('yes');
  });

  it('classifies disagreeing, missing, and not-decodable clips without dropping any row', () => {
    const phone = makePhonePayload(
      {
        demo_dip_13: { count: 11, samplesRead: 317, decoderPath: 'rvfc', poseCoverage: 92 },
        demo_iphone_dip_13_rot: { notDecodable: true, decoderPath: 'none', samplesRead: 0, poseCoverage: null },
      },
      new Set(['demo_ez_curl_10'])
    );
    const computer = makeComputerPayload({
      demo_bicep_curl_5: {
        chromium: { count: null, samplesRead: 0, decoderPath: 'webcodecs', poseCoverage: null, error: 'PartialReadError: 117 samples read where the video holds 179', exact: false },
      },
    });

    const report = compareDemoReads(phone, computer);
    expect(report.rows).toHaveLength(DEMO_CLIPS.length);
    expect(report.ok).toBe(false);

    const disagreeRow = report.rows.find(r => r.id === 'demo_dip_13');
    expect(disagreeRow.agree).toBe('no');
    expect(disagreeRow.phoneCount).toBe('11');
    expect(disagreeRow.computerCount).toBe('13');
    expect(disagreeRow.reason).toContain('differs');

    const missingPhoneRow = report.rows.find(r => r.id === 'demo_ez_curl_10');
    expect(missingPhoneRow.agree).toBe('no');
    expect(missingPhoneRow.phoneCount).toBe('missing');
    expect(missingPhoneRow.reason).toContain('missing from iPhone payload');

    const notDecodableRow = report.rows.find(r => r.id === 'demo_iphone_dip_13_rot');
    expect(notDecodableRow.agree).toBe('no');
    expect(notDecodableRow.phoneCount).toBe('not decodable');
    expect(notDecodableRow.reason).toContain('not decodable');

    const noComputerRow = report.rows.find(r => r.id === 'demo_bicep_curl_5');
    expect(noComputerRow.agree).toBe('no');
    expect(noComputerRow.computerCount).toBe('no read');
    expect(noComputerRow.reason).toContain('PartialReadError: 117 samples read where the video holds 179');

    const md = renderIphoneReadTable(report);
    expect(md).not.toContain('—');
    expect(md).toContain('| Clip | Lift | Label | iPhone | Computer | Agree | Decoder | Samples read | Pose coverage | Note |');
    for (const clip of DEMO_CLIPS) expect(md).toContain(clip.id);
    expect(md).toContain('PartialReadError: 117 samples read where the video holds 179');
  });

  it('handles array payloads, fallback decoder/samples fields, 0% pose coverage, refused sets, and pipe/newline escaping', () => {
    const flatPhone = DEMO_CLIPS.map(clip => {
      if (clip.id === 'demo_dip_13') {
        return { id: clip.id, count: 13, samples: 0, decoder: 'rvfc', poseCoveragePct: 0 };
      }
      if (clip.id === 'demo_ez_curl_10') {
        return { id: clip.id, count: 'refused', refused: true, samples: 120, decoder: 'webcodecs', error: 'bad|err\nline2' };
      }
      return makeEntry(clip);
    });
    const report = compareDemoReads(flatPhone, makeComputerPayload());
    expect(report.rows.find(r => r.id === 'demo_dip_13')).toMatchObject({
      decoder: 'rvfc',
      samplesRead: 0,
      poseCoverage: '0%',
      agree: 'yes',
    });
    const refusedRow = report.rows.find(r => r.id === 'demo_ez_curl_10');
    expect(refusedRow.phoneCount).toBe('refused');
    expect(refusedRow.agree).toBe('no');

    const withEscapedErr = compareDemoReads(
      makePhonePayload({ demo_ez_curl_10: { count: null, error: 'bad|err\nline2', exact: false } }),
      makeComputerPayload()
    );
    const md = renderIphoneReadTable(withEscapedErr);
    expect(md).toContain('bad\\|err line2');
  });

  it('writes table.md and returns exit code 0 on full match, 1 on disagreement or missing clip', () => {
    const dir = mkdtempSync(join(tmpdir(), 'wv-iphone-table-'));
    try {
      const compPath = join(dir, 'computer.json');
      const phoneOkPath = join(dir, 'phone-ok.json');
      const phoneBadPath = join(dir, 'phone-bad.json');
      const outPath = join(dir, 'table.md');
      const script = resolve('scripts/iphone-read-table.mjs');

      writeFileSync(compPath, JSON.stringify(makeComputerPayload()));
      writeFileSync(phoneOkPath, JSON.stringify(makePhonePayload()));
      writeFileSync(phoneBadPath, JSON.stringify(makePhonePayload({ demo_dip_13: { count: 1 } })));

      const okRun = spawnSync(process.execPath, [script, phoneOkPath, '--computer', compPath, '--out', outPath], { encoding: 'utf8' });
      expect(okRun.status).toBe(0);
      const okMd = readFileSync(outPath, 'utf8');
      expect(okMd).toContain(`Agree: ${DEMO_CLIPS.length} of ${DEMO_CLIPS.length}`);

      const badRun = spawnSync(process.execPath, [script, phoneBadPath, '--computer', compPath, '--out', outPath], { encoding: 'utf8' });
      expect(badRun.status).toBe(1);
      const badMd = readFileSync(outPath, 'utf8');
      expect(badMd).toContain(`Agree: ${DEMO_CLIPS.length - 1} of ${DEMO_CLIPS.length}`);
      expect(badMd).toContain('| demo_dip_13 |');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('rejects invalid phone/computer payloads and bad CLI flags cleanly with exit 1', () => {
    const dir = mkdtempSync(join(tmpdir(), 'wv-iphone-badjson-'));
    try {
      const compPath = join(dir, 'computer.json');
      const phoneOkPath = join(dir, 'phone-ok.json');
      const badJson = join(dir, 'bad.json');
      const emptyObj = join(dir, 'empty.json');
      const outPath = join(dir, 'table.md');
      const script = resolve('scripts/iphone-read-table.mjs');
      writeFileSync(compPath, JSON.stringify(makeComputerPayload()));
      writeFileSync(phoneOkPath, JSON.stringify(makePhonePayload()));
      writeFileSync(badJson, '{not valid json');
      writeFileSync(emptyObj, '{}');

      const badRes = spawnSync(process.execPath, [script, badJson, '--computer', compPath, '--out', outPath], { encoding: 'utf8' });
      expect(badRes.status).toBe(1);
      expect(badRes.stderr).toMatch(/JSON/i);

      const noResultsRes = spawnSync(process.execPath, [script, emptyObj, '--computer', compPath, '--out', outPath], { encoding: 'utf8' });
      expect(noResultsRes.status).toBe(1);
      expect(noResultsRes.stderr).toContain('results');

      expect(() => compareDemoReads(makePhonePayload(), {})).toThrow(/Computer payload/);
      expect(() => compareDemoReads(makePhonePayload(), { chromium: 'bad' })).toThrow(/Computer payload/);

      const bogusFlag = spawnSync(process.execPath, [script, phoneOkPath, '--computer', compPath, '--out', outPath, '--bogus'], { encoding: 'utf8' });
      expect(bogusFlag.status).toBe(1);
      expect(bogusFlag.stderr).toContain('Unknown option');

      const missingOutVal = spawnSync(process.execPath, [script, phoneOkPath, '--computer', compPath, '--out'], { encoding: 'utf8' });
      expect(missingOutVal.status).toBe(1);
      expect(missingOutVal.stderr).toContain('Missing value');

      const extraArg = spawnSync(process.execPath, [script, phoneOkPath, 'extra.json', '--computer', compPath, '--out', outPath], { encoding: 'utf8' });
      expect(extraArg.status).toBe(1);
      expect(extraArg.stderr).toContain('Unexpected extra argument');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('uses committed test/real-phone/iphone-read/computer.json: selects Chromium for MP4, WebKit for HEVC MOV, and lists PartialReadError reasons', () => {
    const dir = mkdtempSync(join(tmpdir(), 'wv-iphone-committed-'));
    try {
      const phonePath = join(dir, 'phone.json');
      const outPath = join(dir, 'table.md');
      writeFileSync(phonePath, JSON.stringify(makePhonePayload()));
      const { report, markdown } = buildIphoneReadTable({ phonePath, outPath });
      expect(report.rows).toHaveLength(DEMO_CLIPS.length);
      expect(report.rows.find(r => r.id === 'demo_bodyweight_squat_9')).toMatchObject({
        computerBrowser: 'Chromium',
        computerCount: '9',
        agree: 'yes',
      });
      expect(report.rows.find(r => r.id === 'demo_iphone_dip_13')).toMatchObject({
        computerBrowser: 'macOS WebKit',
        computerCount: '13',
        agree: 'yes',
      });
      const partial = report.rows.find(r => r.id === 'demo_bicep_curl_5');
      expect(partial.computerCount).toBe('no read');
      expect(partial.agree).toBe('no');
      expect(partial.reason).toContain('PartialReadError');
      expect(readFileSync(outPath, 'utf8')).toBe(markdown);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
