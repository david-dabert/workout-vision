# WorkoutVision design system

The standing reference for every screen. Source: the design-system audit of 30 September 2026, made on
branch `claude/generate-architecture-md-inw479` (shots at 390x664, 375x548 and 390x745 in French, 390x664
in English, motion on), grounded in `design/experience-prototype.html` and the tokens of
`src/components/experience/Entry.css`. The tokens below are declared on `.wv-experience` in Entry.css;
a screen takes its sizes, spaces, radii, colours and timings from them, never from a value of its own.

The audit found about 40 font sizes, 17 radii, 20 letter-spacings, 4 short-screen breakpoints, 4 alphas
for the same gold outline and 5 button styles, and the staggered reveal on 3 of 11 screens. Sections 1 to 3
are the audit as delivered; section 4 records what was implemented and what was left.

## 1. The system

### Type: 8 screen roles (the paper sheet keeps its print scale)

| Token | Value | Replaces |
|---|---|---|
| `--fs-display` | `clamp(120px, min(56vw, 30svh), 260px)`, serif, lh .84, -0.04em, `--gold-num` | the result numeral only |
| `--fs-number` | `clamp(64px, 19vw, 76px)`, serif, lh 1, tabular | pct 66, stepper 74, rest 72–96/64, demo numeral 88–112/80 |
| `--fs-title` | `clamp(38px, 10.6vw, 50px)`, serif, lh .98, -0.012em, balance | every h1, refused-title 34–44, hist-n 44, choose-title 32 on short screens |
| `--fs-heading` | `clamp(27px, 7.8vw, 31px)`, serif, lh 1.1 | ask-q 31, all-title 28, welcome-l1 27, steps .n 27, fix-text 26, rp-n 26 |
| `--fs-name` | `23px`, serif, lh 1.05 | item-name, hist-name, prog-name, 22 |
| `--fs-body` | `15px`, sans, lh 1.5 | sub, body-text 16, set-account, saved-msg, text-btn 14, report-sub 14, hist-empty |
| `--fs-caption` | `13px`, sans, lh 1.45, tabular figures | privacy, alias, row small, item-sub 12.5, rp-note 12.5, credits 11, chip/seg 14/13, every mono sentence (res-meta, res-detail, rp-detail, hist-meta, hist-corr, caption) |
| `--fs-label` | `10.5px`, mono, uppercase, `--track-label: 0.2em` | eyebrow .22, list-head/field label .16, pill, tag 9.5, rp-phase 8.5, edge-label 9.5 |

- 16 px stays only for inputs (iOS zoom), the primary button's label and the choice's row titles.
- Hero exceptions, the prototype's own: entry-l1/l2, brand (0.42–0.5em), the `.enter` pill.
- Card fit: `altar-name: min(34px, 8.4vw)`.
- **Mono is for uppercase labels and pure numerals, never for sentences.**
- Tracking: -0.04em display, -0.012em serif, 0 sans, 0.2em labels (0.08em pills and tags), 0.42em brand.
- Paper scale, mirroring the PDF: 9 label, 12 body, 30 title, 58 number.

### Spacing

`--s-1: 4px; --s-2: 8px; --s-3: 12px; --s-4: 16px; --s-5: 24px; --s-6: 32px; --s-7: 48px; --gut: 20px`

By role: topbar to first element 16; label to value 8; title to sub 12; block to block 24; section to
section 32; end of page 48. Two short-screen breakpoints: `(max-height: 700px)` compact and
`(max-height: 600px)` tight.

### Radii

`--r-pill: 999px` (pill, tag, tier, rp-open; icon buttons are 50%), `--r-xl: 30px` (lift card, film frame),
`--r-l: 24px` (glass, fix-note, guide frames, replay frame, account card), `--r-m: 18px` (buttons, inputs,
search), `--r-s: 14px` (chips, segmented controls, fields, compact buttons; a segment inside is 11 = 14 − 3),
`--r-paper: 6px`.

### Buttons: four levels

| Level | Class | Spec | Use |
|---|---|---|---|
| Primary | `.btn-primary` | 58 px, `--r-m`, gold gradient, ink 16/600, shadow `0 12px 28px -16px rgba(232,189,126,.6)` + the two insets | one per screen |
| Secondary outline | `.btn-line` | 54 px, `--r-m`, `1px solid var(--lamp-line)`, `--lamp-hi`, 15 | the one next action: report, prepare video, "Filmer cet exercice" |
| Quiet | `.btn-ghost` (`.is-s`: 44 px, auto width, `--r-s`, 13) | 54 px, `--r-m`, `1px solid var(--hair-2)`, bone, 15, icon 17 px | alternatives; absorbs `.btn-line.is-quiet` and `.guide-action` |
| Text | `.text-btn` (`.is-inline`: no side padding) | 44 px, 15, ash, never underlined | tertiary |

Topbar action: `.rp-open`, one only. Paired buttons share one height (`.ask-row > * { height: 58px }`).

### Colour roles

- Ground: `--void` page; `--basalt` fields and segmented controls; `--well: #0B0908` under figures and
  drawings; glass `rgba(20,17,13,.56)` with blur.
- Text: `--bone` primary; `--bone-2` emphasised secondary; `--ash` captions and labels; `--ash-2`
  placeholder, credits, disabled.
- Accent: `--lamp` eyebrows, selected state, marks, record tag; `--lamp-hi` text on a gold outline, lit
  marks; `--lamp-line: rgba(232,189,126,.55)` the one gold outline; `--lamp-line-strong: .7` selected;
  `--gold-num` gradient only on measured counts (result numeral, demo numeral, replay chip).
- Lines: `--hair` .10 rules and cards; `--hair-2` .18 controls; `--hair-0` .07 list separators.
- Paper: `--paper`, `--paper-ink`, `--paper-ash`, `--paper-rule`, `--paper-rule-2: #F0EADF`, `--paper-gold: #8A6630`.
- No red: errors in `--lamp`.

### Motion

```
--ease: cubic-bezier(.16,1,.3,1)      everything that enters or settles
--ease-exit: cubic-bezier(.4,0,1,1)   leaving layers
press: 60 ms in / 220 ms out, scale .975 + spotlight
--d-fast: .2s     colour, border, background
--d-ui: .45s      dots, bar lighting, leave, is-leaving, fade-in
--d-tick: .34s    numeral tick, digit roll
--d-appear: .9s   cards
--d-screen: .8s   screen in (+50 ms); .5s out on --ease-exit
--d-reveal: 1.1s  blocks rise 18 px, stagger 80 ms + i × 70 ms
```

What animates: screen fades; staggered reveal on every screen; card appear; numeral tick with lit marks;
digit roll; press; dots; the film scan. The entry keeps its choreography. Reduce Motion turns all of it off.

## 2. Deviations found (30 September), ranked by visible impact

| # | Screen | What | Change |
|---|---|---|---|
| 1 | Choice | "Élévations latérales" cut at the card edge (nowrap 36.7 px ≈ 290 px in 272) | `.altar-name { font-size: min(34px, 8.4vw) }` |
| 2 | Result counted | "Non" 54 px beside a 58 px "Oui" | `.ask-row > * { height: 58px }` |
| 3 | Refused, incomplete, counted | Report links underlined; incomplete puts them above the actions | no underline, bone-2; links after the actions everywhere |
| 4 | Refused (outside) | Frame borrowed from Film.css, sized by its `--rest-h`: "Refilmer" below the fold at 664, "HORS / CADRE" wraps | the result screen's own 112 px frame; label nowrap |
| 5 | Guide, choice list | Search field without its magnifier | the prototype's svg in `.search` |
| 6 | Guide | Back is the glyph "←" | the chevron svg |
| 7 | Film, cards | Experimental tier is a bordered two-line mono box; Beta a 10 px box | tier is a pill; experimental is plain caption text |
| 8 | Result saved | Ghost body at 0.2 behind the saved card and account | ghost at 30 % once the question is answered |
| 9 | Every primary above a ghost | Gold haze of the primary's shadow on the button below | tighter shadow |
| 10 | Film caption, result meta/detail, replay detail, history meta/correction | Sentences in tracked mono | sans caption, tabular figures |
| 11 | Report | Title touches Back; sub 14 | 16 px top margin; sub 15 |
| 12 | Report sheet (FR) | "AMPLITUDE" runs into "PIC" | head tracking .06em, nowrap, ellipsis |
| 13 | Watch loading | Glint runs past the bar's end | `clip-path: inset(-2px 0)` |
| 14 | Result | Three micro-lines above the numeral; card below the fold at 548 | tier and meta on one row; smaller numeral under 600 px |
| 15 | Choice list | "BÊTA" ash in the list, gold on cards | `.tag.tier-beta` in lamp |
| 16 | Guide open | Drawings pure white | in the well, sepia .25, brightness .92, opacity .82 |
| 17 | Guide | `.guide-action` a fifth button style | `.btn-line` for filming, `.btn-ghost.is-s` for the rest |
| 18 | History | 62 px gap under the progress | 32 px between every section |
| 19 | Result | Account left-aligned, bare, "En savoir plus" indented | hairline card; summary aligned |
| 20 | Demo | Count as a row, other gradient | stacked, `--gold-num`, `res-tick` |
| 21 | Demo | No serif heading; empty lower screen until the result lands | the line as a serif heading; the result's place held, hidden |
| 22 | Demo | Line skeleton, where every body is particles | particle `Body` (section 3, change 5) |
| 23 | Guide, Report, Replay, Result, Demo, errors | No staggered reveal | `data-reveal` on their blocks |
| 24 | Result counted | Count opens line 2 | no-break space before the count |
| 25 | Replay, Report | Focus ring painted on open | `focus({ focusVisible: false })` |
| 26 | Result topbar | "Revoir" off-centre | grid `44px 1fr auto` |
| 27 | Error screens | Smaller h1 | the title size |
| 28 | Replay | Phase word 8.5 px | label size |
| 29 | Tokens | Hard-coded #110f0c, #0B0908, #050404, #8A6630, #F0EADF; gold outline .5/.55/.6/.7 | `--well`, `--paper-gold`, `--paper-rule-2`, `--lamp-line`, `--lamp-line-strong` |
| 30 | Short screens | Four breakpoints | two: 700 and 600 |

None adds user-facing words; #24 is a no-break space.

## 3. Beyond consistency

1. **Large-title topbar that condenses on scroll** (Guide, History, Report). The topbar sticks; once the
   h1 has passed under it, the bar turns to frosted glass with a hairline and shows the same title, small
   and centred (`topbar.js`, `.topbar.is-sticky/.is-condensed/.topbar-title`).
2. **The result as a staged moment.** Once saved, the numeral docks at 42 % under the lift's name
   (`.result-screen.is-saved .numeral { scale: .42; margin-bottom: -0.487em }`), the marks dim, the ghost
   steps back, and the rest clock takes the stage.
3. **One surface system and one section head.** Glass for the user's turn (ask, fix, the refused fix);
   a hairline card for information (the account); bare lists for catalogues. One `.section-head` (mono
   label over a hairline) for list heads, days, progress and the demo's times.
4. **Numbers behave like instruments.** Rest clock, stepper and analysis percentage draw each digit in a
   cell; only the digit that changes rolls in (`Digits.jsx`, `.dg`, `dg-in`). The gold is kept for
   measured counts.
5. **One body through the whole journey.** The demo in particles, and the watch's last pose carried into
   the result's ghost.

## 4. Status

See the commit messages on the branch for what was implemented. Paper values (9.5, 12, 12.5, 13, 11.5,
10) stay as they are, since they mirror `report-pdf.js`; the level feature's 16 px beginner account and
its per-rep table (11.5 mono) are the level's own sizes.
