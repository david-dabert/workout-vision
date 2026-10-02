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

describe('French strings', () => {
  it('put a no-break space before : ; ? and !', () => {
    const found = [];
    for (const f of [...files(join(ROOT, 'components/experience')), ...files(join(ROOT, 'lib'))]) {
      readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
        if (/^\s*(\/\/|\*)/.test(line)) return;
        for (const m of line.matchAll(LITERAL)) {
          let s = m[0].slice(1, -1);
          while (/\$\{[^{}]*\}/.test(s)) s = s.replace(/\$\{[^{}]*\}/g, '0');
          if (s.includes('${')) continue;  // a template nested in a template: its code is not read as text
          if (FRENCH.test(s) && BAD.test(s)) found.push(`${f.slice(ROOT.length + 1)}:${i + 1}: ${s.slice(0, 80)}`);
        }
      });
    }
    expect(found).toEqual([]);
  });
});
