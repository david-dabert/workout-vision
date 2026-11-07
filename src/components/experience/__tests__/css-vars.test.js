// Every custom property a style reads with var() and no fallback is defined somewhere: in a stylesheet, in index.html,
// or set by the code (an inline style key or setProperty's first argument). A var() that names nothing is dropped by
// the browser to the property's inherited or initial value, without any error: on 7 November 2026 the result screen's
// count lost its display size this way (PR #330: Result.css read six names that Entry.css defined under others).
// raw-colours.test.js checks that a size is written as a token; this checks that the token exists. The properties
// main already read undefined on 7 November 2026 (commit affd274a) are listed with their files; the list only
// shrinks: a property defined or no longer read fails the last test until it is taken off.
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';

const ROOT = resolve(__dirname, '../../../..');
const SRC = join(ROOT, 'src');

// What a file says once its comments are gone: a var() quoted in a comment is neither a definition nor a read. In
// code, a comment is a line opened by //, a block opening a line, or a JSX {/* … */} that closes where its comment
// does; a /* inside a string, as in accept="video/*", opens nothing, so the code after it stays read.
// Known limit (review of 7 November 2026): a "{/*" left unclosed inside a // comment or a string still opens a JSX
// comment and can hide the code up to the next "*/ }". None is in the tree; closing it takes a tokenizer.
function strip(text, isStyle) {
  if (isStyle) return text.replace(/\/\*[\s\S]*?\*\//g, '');
  return text
    .replace(/\{\s*\/\*(?:(?!\*\/)[\s\S])*\*\/\s*\}/g, '')
    .replace(/^\s*\/\*[\s\S]*?\*\//gm, '')
    .split('\n').filter(line => !/^\s*\/\//.test(line)).join('\n');
}

// The expression of each style={…} attribute, ended by counting braces, with quoted strings, template literals,
// and comments skipped, so a style closed as "} }", containing a /* comment */ or chosen by a condition is read
// whole and nothing after it is, and comments inside it define no property.
function styleExpressions(text) {
  const out = [];
  for (const m of text.matchAll(/style=\{/g)) {
    const start = m.index + m[0].length;
    let depth = 1;
    let quote = null;
    let i = start;
    let expr = '';
    for (; i < text.length && depth > 0; i += 1) {
      const c = text[i];
      if (quote) {
        expr += c;
        if (c === '\\') {
          i += 1;
          if (i < text.length) expr += text[i];
        } else if (c === quote) {
          quote = null;
        }
      } else if (c === '/' && text[i + 1] === '*') {
        const end = text.indexOf('*/', i + 2);
        if (end === -1) {
          i = text.length;
          break;
        }
        expr += ' ';
        i = end + 1;
      } else if (c === '/' && text[i + 1] === '/') {
        const end = text.indexOf('\n', i + 2);
        if (end === -1) {
          i = text.length;
          break;
        }
        expr += '\n';
        i = end;
      } else if (c === '"' || c === "'" || c === '`') {
        quote = c;
        expr += c;
      } else if (c === '{') {
        depth += 1;
        expr += c;
      } else if (c === '}') {
        depth -= 1;
        if (depth > 0) expr += c;
      } else {
        expr += c;
      }
    }
    out.push(expr);
  }
  return out;
}

// A stylesheet defines a property by declaring it. Code defines one only as a key of an object in a style={…}
// attribute ('--i': 0, or ['--i']: 0, also under a condition) or as setProperty's first argument. A name anywhere
// else, as in getPropertyValue('--ash') or a table of fallback colours, is not a definition: counting it as one
// would hide the very rename this check exists for.
const STYLE_KEY = /(?<=[{,[]\s*)['"`](--[A-Za-z0-9_-]+)['"`]\]?\s*:/g;
const SET_PROPERTY = /setProperty\(\s*['"`](--[A-Za-z0-9_-]+)['"`]/g;

function definitionsIn(text, isStyle) {
  const clean = strip(text, isStyle);
  if (isStyle) return [...clean.matchAll(/(--[A-Za-z0-9_-]+)\s*:/g)].map(m => m[1]);
  const names = [];
  for (const expression of styleExpressions(clean)) {
    for (const m of expression.matchAll(STYLE_KEY)) names.push(m[1]);
  }
  for (const m of clean.matchAll(SET_PROPERTY)) names.push(m[1]);
  return names;
}

function readsIn(text, isStyle) {
  return [...strip(text, isStyle).matchAll(/var\(\s*(--[A-Za-z0-9_-]+)\s*\)/g)].map(m => m[1]);
}

const walk = dir => readdirSync(dir).flatMap(name => {
  const p = join(dir, name);
  if (statSync(p).isDirectory()) return name === '__tests__' || name === 'node_modules' ? [] : walk(p);
  return /\.(css|js|jsx|ts|tsx)$/.test(name) ? [p] : [];
});
const files = walk(SRC).sort();
const isStyle = p => /\.(css|html)$/.test(p);

const defined = new Set();
for (const p of [...files, join(ROOT, 'index.html')]) {
  for (const name of definitionsIn(readFileSync(p, 'utf8'), isStyle(p))) defined.add(name);
}
const read = {};
for (const p of files) {
  for (const name of readsIn(readFileSync(p, 'utf8'), isStyle(p))) (read[name] ||= new Set()).add(basename(p));
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

describe('the scanner', () => {
  it('counts a declaration, a style key and setProperty as definitions, and a read as none', () => {
    expect(definitionsIn('.a { --x: 1px; color: var(--y); }', true)).toEqual(['--x']);
    expect(definitionsIn("<i style={{ '--i': 0, ['--j']: 1 }} />; el.style.setProperty('--k', v)", false)).toEqual(['--i', '--j', '--k']);
    expect(definitionsIn("getComputedStyle(el).getPropertyValue('--x'); f(a ? '--b' : '--c')", false)).toEqual([]);
    expect(definitionsIn("const FALLBACK = { '--lamp': '#E8BD7E' }; const t = wide ? ['--a'] : ['--b'];", false)).toEqual([]);
    expect(definitionsIn("<i style={{ '--x': 1 } } />;\nconst T = { a: 1, '--lamp': '#E8BD7E' };\n<b style={{ color: 'red' }} />", false)).toEqual(['--x']);
    expect(definitionsIn("<div style={cols ? { '--cols': cols } : undefined} />", false)).toEqual(['--cols']);
    expect(definitionsIn("<i style={{ /* '--x': 1, */ '--y': 2 }} />", false)).toEqual(['--y']);
    expect(definitionsIn("<i style={{ /* } */ '--x': 1 }} />", false)).toEqual(['--x']);
    expect(definitionsIn("<i style={{\n  // don't use '--a': 1\n  '--b': 2\n}} />", false)).toEqual(['--b']);
  });

  it('keeps the code after a /* inside a string, and drops what comments say', () => {
    expect(readsIn('<input accept="video/*" style={{ color: \'var(--nope)\' }} />{/* x */}', false)).toEqual(['--nope']);
    expect(readsIn("// color: var(--a)\n/* var(--b) */\nconst s = { color: 'var(--c)' };", false)).toEqual(['--c']);
    expect(readsIn("function f() {\n  /* note */\n  return 'var(--x)';\n}\ntry { g(); } catch (e) { /* none */ }", false)).toEqual(['--x']);
    expect(readsIn('/* var(--a) */ .b { color: var(--b, red); background: var(--c); }', true)).toEqual(['--c']);
  });
});

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
