/**
 * French typography in the app's own strings (src/components/experience, src/lib): a no-break space, never an
 * ordinary one, before : ; ? and !, so the sign never starts a line alone (David, 2 October 2026: details).
 * Strings are read from the source; the code inside ${…} is left out.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve(__dirname, '../..');
const files = dir => readdirSync(dir).flatMap(f => {
  const p = join(dir, f);
  if (statSync(p).isDirectory()) return f === '__tests__' ? [] : files(p);
  return /\.(js|jsx|ts)$/.test(f) ? [p] : [];
});
const LITERAL = /'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`|"(?:[^"\\\n]|\\.)*"/g;
const FRENCH = /[éèàçêùôîœ’]|\b(le|la|les|vous|votre|vos|des|une|est|pas)\b/;
const BAD = /[\p{L}\d)»%] [:;?!](?=\s|$)/u;
const BAD_PCT = /\d %(?!\w)/u;
const BAD_GUILLEMET = /«\x20|\x20»/u;

describe('French strings', () => {
  const allDirs = [
    join(ROOT, 'components/experience'),
    join(ROOT, 'components/kine'),
    join(ROOT, 'components/reference'),
    join(ROOT, 'lib'),
  ];

  it('put a no-break space before : ; ? ! and %, and inside « … »', () => {
    const found = [];
    for (const f of allDirs.flatMap(files)) {
      readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
        if (/^\s*(\/\/|\*)/.test(line)) return;
        for (const m of line.matchAll(LITERAL)) {
          let s = m[0].slice(1, -1);
          while (/\$\{[^{}]*\}/.test(s)) s = s.replace(/\$\{[^{}]*\}/g, '0');
          if (s.includes('${')) continue;  // a template nested in a template: its code is not read as text
          const norm = s.replace(/\\u00[aA]0/g, '\u00A0');
          if (FRENCH.test(norm) && (BAD.test(norm) || (!f.startsWith(join(ROOT, 'lib')) && (BAD_PCT.test(norm) || BAD_GUILLEMET.test(norm))))) {
            found.push(`${f.slice(ROOT.length + 1)}:${i + 1}: ${s.slice(0, 80)}`);
          }
        }
      });
    }
    expect(found).toEqual([]);
  });

  it('has no English labels on French screens in Entry, Choice, or OneTouchHub', () => {
    const choice = readFileSync(join(ROOT, 'components/experience/Choice.jsx'), 'utf8');
    const entry = readFileSync(join(ROOT, 'components/experience/Entry.jsx'), 'utf8');
    const oneTouch = readFileSync(join(ROOT, 'components/experience/one-touch-copy.js'), 'utf8');
    expect(choice).not.toContain("fr ? 'Roadmap & Nouvelles disciplines'");
    expect(choice).not.toContain('fr ? \'100% Local');
    expect(choice).toContain("fr ? 'En préparation et nouvelles disciplines'");
    expect(choice).toContain("fr ? 'Atelier multisport'");
    expect(entry).toContain("lang === 'en' ? 'LAB' : 'DÉMO'");
    expect(oneTouch).toContain("title: 'Mon suivi'");
  });
});
