#!/usr/bin/env python3
"""Writes src/components/experience/pdf-fonts/: the app's fonts for the coach's PDF.

jsPDF embeds TrueType only, and does no shaping. This script takes the Google
Fonts releases of the app's faces (pinned below, checked by SHA-256), makes the
static instances the PDF uses, cuts them to the Latin range of the app's own
webfonts (Geist Regular also to Latin Extended and Vietnamese, since it sets the
names and notes the visitor types), and records each face's kerning as a
shaper applies it, since jsPDF will not.

    python3 -m venv /tmp/wv-fonts && /tmp/wv-fonts/bin/pip install fonttools==4.62.1
    /tmp/wv-fonts/bin/python scripts/pdf-fonts.py            # downloads the sources
    /tmp/wv-fonts/bin/python scripts/pdf-fonts.py SRC_DIR    # or reads them from a google/fonts checkout

With fontTools 4.62.1 every run writes the same fonts.js.
"""
import base64, hashlib, io, json, os, sys, urllib.request
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from fontTools import subset

COMMIT = '23e54b51ddffbc7713c583748e3bd86f62b1fa4a'  # google/fonts
SOURCES = {
    'ofl/geist/Geist[wght].ttf': '73894e0448cae90a92b6c2f8732b7bb9acb7b94c418bff559dad4a18e1de9659',
    'ofl/geistmono/GeistMono[wght].ttf': 'd00e590b8eb3a59acc329b2d044fd143ae935090b7da33199ebee27cc7de8196',
    'ofl/instrumentserif/InstrumentSerif-Regular.ttf': '498efd461f6ddfcb7a111bf9a565709d2085d48201d501ead960d93e84ffbb88',
    'ofl/geist/OFL.txt': '1781d2806a07d91c4edf4740b88449fab7d0eadad53f7c351b94cd4d4eb8c00f',
    'ofl/instrumentserif/OFL.txt': '129ed7618959716959f2941fdd5b49e0ad6e6c1d78726761786a00253d865521',
}
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'src', 'components', 'experience', 'pdf-fonts')

LATIN = 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD'
LATIN_EXT = 'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF'
VIET = 'U+0102-0103,U+0110-0111,U+0128-0129,U+0168-0169,U+01A0-01A1,U+01AF-01B0,U+0300-0301,U+0303-0304,U+0308-0309,U+0323,U+0329,U+1EA0-1EF9,U+20AB'
# key in the module, source, weight, ranges, file name in the PDF
FACES = [
    ('serif', 'ofl/instrumentserif/InstrumentSerif-Regular.ttf', None, LATIN, 'InstrumentSerif-Regular.ttf'),
    ('sans', 'ofl/geist/Geist[wght].ttf', 400, LATIN + ',' + LATIN_EXT + ',' + VIET, 'Geist-Regular.ttf'),
    ('sansMedium', 'ofl/geist/Geist[wght].ttf', 500, LATIN, 'Geist-Medium.ttf'),
    ('mono', 'ofl/geistmono/GeistMono[wght].ttf', 400, LATIN, 'GeistMono-Regular.ttf'),
]


def source(path, local):
    if local:
        data = open(os.path.join(local, path), 'rb').read()
    else:
        url = f'https://raw.githubusercontent.com/google/fonts/{COMMIT}/' + path.replace('[', '%5B').replace(']', '%5D')
        data = urllib.request.urlopen(url).read()
    if hashlib.sha256(data).hexdigest() != SOURCES[path]:
        sys.exit(f'{path}: SHA-256 does not match the pinned release')
    return data


def codepoints(ranges):
    out = set()
    for part in ranges.split(','):
        a, _, b = part.strip()[2:].partition('-')
        out.update(range(int(a, 16), int(b or a, 16) + 1))
    return sorted(out)


def instance(data, wght):
    font = TTFont(io.BytesIO(data))
    return instancer.instantiateVariableFont(font, {'wght': wght}, updateFontNames=True) if 'fvar' in font else font


def cut(font, ranges):
    opts = subset.Options()
    opts.layout_features = []
    opts.drop_tables += ['GSUB', 'GPOS', 'GDEF', 'STAT', 'DSIG', 'gasp', 'prep', 'fpgm', 'cvt ', 'hdmx', 'LTSH', 'VDMX', 'kern']
    opts.hinting = False
    opts.name_IDs = [0, 1, 2, 3, 4, 5, 6]
    opts.notdef_outline = True
    opts.glyph_names = False
    opts.recalc_bounds = True
    s = subset.Subsetter(opts)
    s.populate(unicodes=codepoints(ranges))
    s.subset(font)
    font.recalcTimestamp = False  # the release's own date, so every run writes the same bytes
    buf = io.BytesIO()
    font.save(buf)
    return buf.getvalue()


def kerning(font, chars):
    """Pair adjustments as a shaper applies them: within a lookup the first subtable
    that applies decides (format 1 when it lists the pair, format 2 whenever the first
    glyph is covered, even with a zero value); the lookups of the feature add up."""
    if 'GPOS' not in font:
        return {}
    cmap = font.getBestCmap()
    g2c = {}
    for c in chars:
        if cmap.get(c):
            g2c.setdefault(cmap[c], []).append(c)
    glyphs = list(g2c)
    gpos = font['GPOS'].table
    lookups = sorted({i for fr in gpos.FeatureList.FeatureRecord if fr.FeatureTag == 'kern' for i in fr.Feature.LookupListIndex})
    total = {}
    for li in lookups:
        lk = gpos.LookupList.Lookup[li]
        subs = [s.ExtSubTable for s in lk.SubTable] if lk.LookupType == 9 else list(lk.SubTable)
        if not subs or subs[0].LookupType != 2:
            continue
        decided = {}
        for st in subs:
            if st.Format == 1:
                for i, g1 in enumerate(st.Coverage.glyphs):
                    if g1 not in g2c:
                        continue
                    for pvr in st.PairSet[i].PairValueRecord:
                        if pvr.SecondGlyph in g2c and (g1, pvr.SecondGlyph) not in decided:
                            decided[(g1, pvr.SecondGlyph)] = (getattr(pvr.Value1, 'XAdvance', 0) or 0) if pvr.Value1 else 0
            elif st.Format == 2:
                cd1, cd2 = st.ClassDef1.classDefs, st.ClassDef2.classDefs
                for g1 in st.Coverage.glyphs:
                    if g1 not in g2c:
                        continue
                    row = st.Class1Record[cd1.get(g1, 0)].Class2Record
                    for g2 in glyphs:
                        if (g1, g2) not in decided:
                            v1 = row[cd2.get(g2, 0)].Value1
                            decided[(g1, g2)] = (getattr(v1, 'XAdvance', 0) or 0) if v1 else 0
        for k, v in decided.items():
            total[k] = total.get(k, 0) + v
    return {(a, b): v for (g1, g2), v in total.items() if v for a in g2c[g1] for b in g2c[g2]}


def classes(pairs):
    """Characters with the same kerning, grouped: left classes, right classes, and their table."""
    rows = {}
    for (a, b), v in pairs.items():
        rows.setdefault(a, {})[b] = v
    lclass = {}
    for a, row in rows.items():
        lclass.setdefault(tuple(sorted(row.items())), []).append(a)
    lefts = list(lclass.values())
    li = {a: i for i, members in enumerate(lefts) for a in members}
    cols = {}
    for (a, b), v in pairs.items():
        cols.setdefault(b, {})[li[a]] = v
    rclass = {}
    for b, col in cols.items():
        rclass.setdefault(tuple(sorted(col.items())), []).append(b)
    table = sorted([l, ri, v] for ri, key in enumerate(rclass) for l, v in key)
    return {'left': [''.join(map(chr, sorted(m))) for m in lefts], 'right': [''.join(map(chr, sorted(m))) for m in rclass.values()], 'table': table}


def main():
    local = sys.argv[1] if len(sys.argv) > 1 else None
    data = {path: source(path, local) for path in SOURCES}
    lines = [
        "// The app's fonts for the PDF, as TrueType (jsPDF embeds TrueType only).",
        "// Generated by scripts/pdf-fonts.py, do not edit. Static instances of the Google Fonts releases",
        "// (Instrument Serif 1.000; Geist 1.800 at weights 400 and 500; Geist Mono 1.701",
        "// at 400), cut with fontTools to the Latin range of the app's own webfonts,",
        "// Geist Regular also to Latin Extended and Vietnamese, since it sets the names",
        "// and notes the visitor types. No hinting and no layout tables, since jsPDF",
        "// does no shaping; each font's kerning (GPOS 'kern', as a shaper applies it)",
        "// comes instead as classes of characters and a table of their adjustments,",
        "// in thousandths of the size. Geist Mono has none.",
        "// Licence: SIL Open Font License 1.1, see OFL-Geist.txt and OFL-InstrumentSerif.txt.",
        "export const FONTS = {",
    ]
    for key, path, wght, ranges, name in FACES:
        ttf = cut(instance(data[path], wght), ranges)
        pairs = kerning(instance(data[path], wght), sorted(TTFont(io.BytesIO(ttf)).getBestCmap().keys()))
        kern = (', kern: ' + json.dumps(classes(pairs), ensure_ascii=False, separators=(',', ':'))) if pairs else ''
        lines.append(f"  {key}: {{ file: '{name}', data: '{base64.b64encode(ttf).decode()}'{kern} }},")
        print(f'{name}: {len(ttf)} bytes, {len(pairs)} kerning pairs')
    lines.append('};')
    os.makedirs(OUT, exist_ok=True)
    with open(os.path.join(OUT, 'fonts.js'), 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines) + '\n')
    for path, name in [('ofl/geist/OFL.txt', 'OFL-Geist.txt'), ('ofl/instrumentserif/OFL.txt', 'OFL-InstrumentSerif.txt')]:
        with open(os.path.join(OUT, name), 'wb') as f:
            f.write(data[path])
    print('wrote', os.path.normpath(OUT))


if __name__ == '__main__':
    main()
