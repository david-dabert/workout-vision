// Every custom property a style reads with var() and no fallback is defined somewhere: in a stylesheet, in index.html,
// or set by the code (an inline style key or setProperty, both written as a quoted '--name'). A var() that names
// nothing is dropped by the browser to the property's inherited or initial value, without any error: on 7 November
// 2026 the result screen's count lost its display size this way (PR #330: Result.css read six names that Entry.css
// defined under others). raw-colours.test.js checks that a size is written as a token; this checks that the token
// exists. The properties main already read undefined on 7 November 2026 (commit affd274a) are listed with their files;
// the list only shrinks: a property defined or no longer read fails the second test until it is taken off.
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';

const ROOT = resolve(__dirname, '../../../..');
const SRC = join(ROOT, 'src');

const walk = dir => readdirSync(dir).flatMap(name => {
  const p = join(dir, name);
  if (statSync(p).isDirectory()) return name === '__tests__' || name === 'node_modules' ? [] : walk(p);
  return /\.(css|js|jsx|ts|tsx)$/.test(name) ? [p] : [];
});
const files = walk(SRC).sort();
const isStyle = p => /\.(css|html)$/.test(p);

// What a file says once its comments are gone: a var() quoted in a comment is neither a definition nor a read.
const code = p => {
  const text = readFileSync(p, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  return isStyle(p) ? text : text.split('\n').filter(line => !/^\s*\/\//.test(line)).join('\n');
};

const defined = new Set();
for (const p of [...files, join(ROOT, 'index.html')]) {
  const pattern = isStyle(p) ? /(--[A-Za-z0-9_-]+)\s*:/g : /['"`](--[A-Za-z0-9_-]+)['"`]/g;
  for (const m of code(p).matchAll(pattern)) defined.add(m[1]);
}

const read = {};
for (const p of files) {
  for (const m of code(p).matchAll(/var\(\s*(--[A-Za-z0-9_-]+)\s*\)/g)) (read[m[1]] ||= new Set()).add(basename(p));
}
const undefinedNow = Object.fromEntries(Object.entries(read)
  .filter(([name]) => !defined.has(name))
  .map(([name, where]) => [name, [...where].sort()]));

// Read undefined on main on 7 November 2026 (commit affd274a), each with the files that read it.
const KNOWN = {
  '--fs-sub': ['Report.css'],
  '--green': ['DataPortability.jsx', 'Profile.jsx'],
  '--hair-1': ['MovementOptimization.css'],
  '--primary': ['DataPortability.jsx', 'Profile.module.css'],
  '--r-full': ['Live.css', 'MovementOptimization.css'],
  '--r-md': ['MovementOptimization.css'],
  '--shade': ['InvestorShowcaseModal.css'],
  '--shadow-card': ['MocapViewer.css'],
};

describe('custom properties read without a fallback', () => {
  it('reads the stylesheets and finds the type tokens', () => {
    expect(files.filter(p => p.endsWith('.css')).length).toBeGreaterThanOrEqual(50);
    expect(defined.has('--fs-hero-num')).toBe(true);
    expect(defined.has('--fs-res-q-fix')).toBe(true);
  });

  it('are all defined, beyond the ones main read undefined on 7 November 2026', () => {
    const fresh = Object.fromEntries(Object.entries(undefinedNow)
      .filter(([name, where]) => !KNOWN[name] || where.some(f => !KNOWN[name].includes(f))));
    expect(fresh, 'define the property in _tokens.css or Entry.css, or read one that exists').toEqual({});
  });

  it('lists as known only what is still read undefined', () => {
    for (const [name, where] of Object.entries(KNOWN)) {
      expect(undefinedNow[name] || [], `${name} is now defined or no longer read: take it off KNOWN`).toEqual(where);
    }
  });
});
