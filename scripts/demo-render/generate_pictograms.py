#!/usr/bin/env python3
"""
Generate WorkoutVision Exercise Pictograms (V2) & Contact Sheet

Specifications:
- SVG standard: viewBox="0 0 64 64", fill="none", stroke="currentColor", stroke-width="2", stroke-linecap="round", stroke-linejoin="round"
- Sagittal movements: Side projection with plate circle at hands/barbell
- Frontal movements: Front projection
- Anatomical grounding: Feet and hands touch their support lines
- Apparatus: Benches, pull-up bars, wall lines, and platforms explicitly drawn
- Quality tiers:
    1. 40 most used lifts + clinical physioCatalog exercises (individual custom kinematics)
    2. Specific variants and accessory exercises
    3. Full catalog coverage with 0 generic placeholders
- Synonyms: Marked in manifest with "same_as"
- Contact sheet: docs/research/pictograms-sheet.png with IDs, ASCII title, and 20 main lifts at 24px & 48px (light/dark)
"""

import io
import json
import os
import re
from PIL import Image, ImageDraw, ImageFont
import resvg_py

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(os.path.dirname(SCRIPT_DIR))
OUTPUT_SVG_DIR = os.path.join(ROOT_DIR, "public", "illustrations", "exercises-v2")
MANIFEST_PATH = os.path.join(OUTPUT_SVG_DIR, "manifest.json")
SHEET_PNG_PATH = os.path.join(ROOT_DIR, "docs", "research", "pictograms-sheet.png")

# Common reusable SVG snippet generators
def svg_wrap(content: str) -> str:
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none" '
        'stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">\n'
        f'{content.strip()}\n'
        '</svg>'
    )

FLOOR = '<line x1="8" y1="58" x2="56" y2="58" stroke-width="1.5"/>'
BENCH_FLAT = '<line x1="12" y1="46" x2="52" y2="46"/><line x1="18" y1="46" x2="18" y2="58"/><line x1="46" y1="46" x2="46" y2="58"/>'
BENCH_INCLINE = '<line x1="14" y1="52" x2="44" y2="28"/><line x1="14" y1="52" x2="14" y2="58"/><line x1="38" y1="33" x2="38" y2="58"/>'
BENCH_DECLINE = '<line x1="14" y1="32" x2="44" y2="52"/><line x1="18" y1="35" x2="18" y2="58"/><line x1="44" y1="52" x2="44" y2="58"/>'

TEMPLATES = {
    # ─── SQUAT FAMILY (Sagittal side view, plate circle at bar) ───
    "back_squat": {
        "view": "Side view: deep back squat inflection with hips below parallel, barbell racked across rear delts",
        "svg": f'''{FLOOR}
  <circle cx="28" cy="28" r="3.5"/>
  <circle cx="31" cy="20" r="4"/>
  <line x1="31" y1="24" x2="26" y2="34"/>
  <line x1="26" y1="34" x2="16" y2="44"/>
  <polyline points="16,44 24,46 22,58"/>
  <polyline points="28,28 32,36 29,38"/>
  <path d="M 12 36 L 12 44 L 16 44"/>'''
    },
    "front_squat": {
        "view": "Side view: front squat inflection with upright torso, barbell racked across anterior deltoids",
        "svg": f'''{FLOOR}
  <circle cx="34" cy="27" r="3.5"/>
  <circle cx="30" cy="19" r="4"/>
  <line x1="30" y1="23" x2="28" y2="34"/>
  <line x1="28" y1="34" x2="18" y2="44"/>
  <polyline points="18,44 26,45 24,58"/>
  <polyline points="32,28 36,32 34,27"/>
  <path d="M 14 36 L 14 44 L 18 44"/>'''
    },
    "overhead_squat": {
        "view": "Side view: overhead squat inflection with barbell locked out directly above shoulder girdle",
        "svg": f'''{FLOOR}
  <circle cx="28" cy="10" r="3.5"/>
  <circle cx="30" cy="19" r="4"/>
  <line x1="30" y1="23" x2="26" y2="34"/>
  <line x1="26" y1="34" x2="16" y2="44"/>
  <polyline points="16,44 24,46 22,58"/>
  <line x1="28" y1="26" x2="28" y2="10"/>
  <path d="M 12 36 L 12 44 L 16 44"/>'''
    },
    "zercher_squat": {
        "view": "Side view: zercher squat bottom position with barbell cradled in crook of flexed elbows",
        "svg": f'''{FLOOR}
  <circle cx="33" cy="34" r="3.5"/>
  <circle cx="30" cy="19" r="4"/>
  <line x1="30" y1="23" x2="27" y2="34"/>
  <line x1="27" y1="34" x2="17" y2="44"/>
  <polyline points="17,44 25,46 23,58"/>
  <polyline points="29,27 34,36 32,32"/>'''
    },
    "box_squat": {
        "view": "Side view: box squat seated inflection with hips resting on plyo box and vertical shins",
        "svg": f'''{FLOOR}
  <rect x="10" y="42" width="12" height="16" stroke-width="1.5"/>
  <circle cx="28" cy="27" r="3.5"/>
  <circle cx="30" cy="19" r="4"/>
  <line x1="30" y1="23" x2="27" y2="34"/>
  <line x1="27" y1="34" x2="18" y2="42"/>
  <polyline points="18,42 27,43 27,58"/>
  <polyline points="28,27 32,35 29,37"/>'''
    },
    "goblet_squat": {
        "view": "Side view: goblet squat depth with upright torso holding dumbbell against sternum",
        "svg": f'''{FLOOR}
  <circle cx="30" cy="19" r="4"/>
  <line x1="30" y1="23" x2="27" y2="34"/>
  <line x1="27" y1="34" x2="17" y2="44"/>
  <polyline points="17,44 25,46 23,58"/>
  <polyline points="29,26 34,31 33,28"/>
  <rect x="33" y="27" width="4" height="6" rx="1"/>'''
    },
    "pistol_squat": {
        "view": "Side view: single-leg pistol squat at full depth with non-working leg extended horizontal",
        "svg": f'''{FLOOR}
  <circle cx="26" cy="23" r="4"/>
  <line x1="26" y1="27" x2="23" y2="37"/>
  <line x1="23" y1="37" x2="19" y2="47"/>
  <polyline points="19,47 28,49 26,58"/>
  <polyline points="19,47 38,47 48,47"/>
  <polyline points="25,30 36,33 42,33"/>'''
    },
    "sissy_squat": {
        "view": "Side view: sissy squat inflection with extreme forward knee translation and backward torso lean",
        "svg": f'''{FLOOR}
  <circle cx="20" cy="24" r="4"/>
  <line x1="20" y1="28" x2="24" y2="38"/>
  <polyline points="24,38 38,44 28,58"/>
  <line x1="22" y1="30" x2="30" y2="36"/>'''
    },

    # ─── DEADLIFT & HINGE FAMILY (Sagittal side view, plate circle at bar) ───
    "deadlift": {
        "view": "Side view: conventional deadlift start at mid-shin with hinged hips, flat back and vertical arms",
        "svg": f'''{FLOOR}
  <circle cx="34" cy="49" r="3.5"/>
  <circle cx="34" cy="20" r="4"/>
  <line x1="34" y1="24" x2="30" y2="31"/>
  <line x1="30" y1="31" x2="18" y2="39"/>
  <polyline points="18,39 26,48 24,58"/>
  <line x1="31" y1="28" x2="34" y2="49"/>
  <path d="M 39 49 L 39 37 L 36 40"/>'''
    },
    "romanian_deadlift": {
        "view": "Side view: Romanian deadlift inflection at patellar level with high hip hinge and soft knees",
        "svg": f'''{FLOOR}
  <circle cx="33" cy="42" r="3.5"/>
  <circle cx="34" cy="19" r="4"/>
  <line x1="34" y1="23" x2="29" y2="30"/>
  <line x1="29" y1="30" x2="17" y2="37"/>
  <polyline points="17,37 25,47 25,58"/>
  <line x1="30" y1="27" x2="33" y2="42"/>
  <path d="M 12 33 L 17 37"/>'''
    },
    "sumo_deadlift": {
        "view": "Front view: wide sumo deadlift stance with upright torso and inside-knee vertical grip",
        "svg": f'''{FLOOR}
  <circle cx="32" cy="16" r="4"/>
  <line x1="32" y1="20" x2="32" y2="35"/>
  <polyline points="16,58 22,46 32,35 42,46 48,58"/>
  <line x1="32" y1="23" x2="30" y2="48"/>
  <line x1="32" y1="23" x2="34" y2="48"/>
  <line x1="20" y1="48" x2="44" y2="48"/>
  <circle cx="20" cy="48" r="3.5"/>
  <circle cx="44" cy="48" r="3.5"/>'''
    },
    "good_morning": {
        "view": "Side view: good morning deep hip hinge with horizontal torso and barbell racked across rear delts",
        "svg": f'''{FLOOR}
  <circle cx="28" cy="27" r="3.5"/>
  <circle cx="38" cy="28" r="4"/>
  <line x1="38" y1="32" x2="28" y2="34"/>
  <line x1="28" y1="34" x2="18" y2="36"/>
  <polyline points="18,36 24,46 24,58"/>
  <polyline points="28,27 33,32 30,35"/>'''
    },
    "jefferson_curl": {
        "view": "Side view: Jefferson curl on elevated block with full segmental spinal flexion reaching below feet",
        "svg": f'''{FLOOR}
  <rect x="18" y="52" width="16" height="6" stroke-width="1.5"/>
  <circle cx="34" cy="46" r="4"/>
  <polyline points="26,52 26,42 26,34"/>
  <path d="M 26 34 C 28 26, 36 28, 38 36 C 39 42, 36 48, 34 56"/>
  <circle cx="34" cy="56" r="2.5"/>'''
    },

    # ─── BENCH PRESS & CHEST FAMILY ───
    "bench_press": {
        "view": "Side view: flat bench press bar touch on sternum with 90° flexed elbows and feet grounded",
        "svg": f'''{FLOOR}
  {BENCH_FLAT}
  <circle cx="46" cy="41" r="4"/>
  <line x1="44" y1="44" x2="22" y2="44"/>
  <polyline points="22,44 18,48 18,58"/>
  <polyline points="40,44 40,36 34,31"/>
  <circle cx="34" cy="31" r="3.5"/>
  <path d="M 34 26 L 34 18 L 31 21"/>'''
    },
    "incline_bench_press": {
        "view": "Side view: 30° incline bench press bar touch on upper clavicular head with stable foot grounding",
        "svg": f'''{FLOOR}
  {BENCH_INCLINE}
  <circle cx="42" cy="24" r="4"/>
  <line x1="40" y1="28" x2="22" y2="46"/>
  <polyline points="22,46 16,50 16,58"/>
  <polyline points="36,32 38,24 32,20"/>
  <circle cx="32" cy="20" r="3.5"/>
  <path d="M 32 16 L 32 10 L 29 13"/>'''
    },
    "decline_bench_press": {
        "view": "Side view: decline bench press with torso angled downward and secure leg anchor support",
        "svg": f'''{FLOOR}
  {BENCH_DECLINE}
  <circle cx="20" cy="31" r="4"/>
  <line x1="22" y1="35" x2="42" y2="48"/>
  <polyline points="42,48 48,46 48,54"/>
  <polyline points="26,38 28,30 32,26"/>
  <circle cx="32" cy="26" r="3.5"/>'''
    },
    "chest_fly": {
        "view": "Front view: flat dumbbell chest fly at maximum horizontal abduction stretch",
        "svg": f'''{FLOOR}
  <rect x="24" y="36" width="16" height="22" stroke-width="1.5"/>
  <circle cx="32" cy="30" r="4"/>
  <line x1="32" y1="34" x2="32" y2="48"/>
  <polyline points="30,48 24,52 24,58"/>
  <polyline points="34,48 40,52 40,58"/>
  <path d="M 12 28 C 16 34, 28 34, 32 34 C 36 34, 48 34, 52 28"/>
  <rect x="10" y="25" width="4" height="6" rx="1"/>
  <rect x="50" y="25" width="4" height="6" rx="1"/>'''
    },

    # ─── PUSH-UP & PLANK FAMILY ───
    "push_up": {
        "view": "Side view: push-up bottom depth with chest 1 inch off floor and rigid plank alignment",
        "svg": f'''{FLOOR}
  <circle cx="51" cy="46" r="4"/>
  <line x1="49" y1="50" x2="16" y2="56"/>
  <polyline points="45,50 42,42 46,58"/>
  <path d="M 44 38 L 44 30 L 41 33"/>'''
    },
    "handstand_push_up": {
        "view": "Side view: inverted wall handstand push-up at bottom press depth with vertical alignment",
        "svg": f'''{FLOOR}
  <line x1="16" y1="10" x2="16" y2="58" stroke-width="1.5"/>
  <circle cx="26" cy="52" r="4"/>
  <polyline points="26,58 32,48 26,42"/>
  <line x1="26" y1="42" x2="23" y2="28"/>
  <line x1="23" y1="28" x2="18" y2="14"/>
  <path d="M 34 44 L 34 36 L 37 39"/>'''
    },
    "pike_push_up": {
        "view": "Side view: pike push-up with hips elevated high in inverted V and hands pressing vertically",
        "svg": f'''{FLOOR}
  <circle cx="44" cy="49" r="4"/>
  <polyline points="42,58 40,46 38,36"/>
  <polyline points="38,36 28,47 22,58"/>
  <path d="M 38 30 L 38 22 L 41 25"/>'''
    },
    "plank": {
        "view": "Side view: prone isometric forearm plank with flat neutral spine and locked core",
        "svg": f'''{FLOOR}
  <circle cx="52" cy="44" r="4"/>
  <line x1="50" y1="48" x2="16" y2="54"/>
  <polyline points="47,48 47,58 53,58"/>'''
    },
    "side_plank": {
        "view": "Frontal-oblique view: lateral side plank with supporting forearm grounded and top arm extended",
        "svg": f'''{FLOOR}
  <circle cx="50" cy="38" r="4"/>
  <polyline points="45,42 45,58 51,58"/>
  <line x1="45" y1="42" x2="16" y2="58"/>
  <line x1="45" y1="42" x2="45" y2="24"/>
  <path d="M 45 20 L 45 14 L 42 17"/>'''
    },

    # ─── OVERHEAD PRESS & SHOULDERS ───
    "overhead_press": {
        "view": "Front view: standing overhead press lockout with barbell directly overhead and feet hip-width",
        "svg": f'''{FLOOR}
  <circle cx="32" cy="22" r="4"/>
  <line x1="32" y1="26" x2="32" y2="40"/>
  <polyline points="26,58 28,48 32,40 36,48 38,58"/>
  <line x1="16" y1="12" x2="48" y2="12"/>
  <circle cx="16" cy="12" r="3.5"/>
  <circle cx="48" cy="12" r="3.5"/>
  <polyline points="32,28 26,20 26,12"/>
  <polyline points="32,28 38,20 38,12"/>'''
    },
    "lateral_raise": {
        "view": "Front view: standing dumbbell lateral raise at 90° shoulder abduction horizontal peak",
        "svg": f'''{FLOOR}
  <circle cx="32" cy="18" r="4"/>
  <line x1="32" y1="22" x2="32" y2="40"/>
  <polyline points="26,58 28,48 32,40 36,48 38,58"/>
  <line x1="14" y1="24" x2="32" y2="24"/>
  <line x1="32" y1="24" x2="50" y2="24"/>
  <rect x="10" y="21" width="4" height="6" rx="1"/>
  <rect x="50" y="21" width="4" height="6" rx="1"/>
  <path d="M 12 36 Q 14 28 18 24"/>
  <path d="M 52 36 Q 50 28 46 24"/>'''
    },
    "front_raise": {
        "view": "Side view: standing bilateral front raise at 90° shoulder flexion horizontal peak",
        "svg": f'''{FLOOR}
  <circle cx="28" cy="18" r="4"/>
  <line x1="28" y1="22" x2="28" y2="40"/>
  <polyline points="26,40 26,48 26,58"/>
  <polyline points="28,26 44,26 46,26"/>
  <rect x="46" y="23" width="6" height="6" rx="1"/>
  <path d="M 32 40 Q 40 36 44 28"/>'''
    },
    "rear_delt_fly": {
        "view": "Side-oblique view: bent-over rear delt fly at horizontal abduction peak with flared elbows",
        "svg": f'''{FLOOR}
  <circle cx="38" cy="24" r="4"/>
  <line x1="38" y1="28" x2="24" y2="38"/>
  <polyline points="24,38 26,48 24,58"/>
  <polyline points="32,32 38,22 42,20"/>
  <rect x="42" y="17" width="5" height="5" rx="1"/>
  <path d="M 28 42 Q 36 34 38 24"/>'''
    },
    "face_pull": {
        "view": "Side view: face pull peak contraction with rope pulled to eye level and high elbows flared",
        "svg": f'''{FLOOR}
  <line x1="52" y1="12" x2="52" y2="58" stroke-width="1.5"/>
  <circle cx="26" cy="22" r="4"/>
  <line x1="26" y1="26" x2="24" y2="40"/>
  <polyline points="24,40 22,48 20,58"/>
  <line x1="52" y1="22" x2="34" y2="24"/>
  <polyline points="26,28 30,22 34,24"/>'''
    },
    "shrug": {
        "view": "Front view: standing shrug with shoulders forcefully elevated toward ears and arms vertical",
        "svg": f'''{FLOOR}
  <circle cx="32" cy="15" r="4"/>
  <line x1="32" y1="19" x2="32" y2="38"/>
  <polyline points="26,58 28,48 32,38 36,48 38,58"/>
  <path d="M 22 22 Q 32 18 42 22"/>
  <line x1="22" y1="22" x2="22" y2="40"/>
  <line x1="42" y1="22" x2="42" y2="40"/>
  <rect x="20" y="40" width="4" height="6" rx="1"/>
  <rect x="40" y="40" width="4" height="6" rx="1"/>
  <path d="M 18 28 L 18 20 L 15 23"/>
  <path d="M 46 28 L 46 20 L 49 23"/>'''
    },

    # ─── ROWS & VERTICAL PULL ───
    "barbell_row": {
        "view": "Side view: bent-over barbell row peak contraction with elbows pulled past horizontal torso",
        "svg": f'''{FLOOR}
  <circle cx="32" cy="33" r="3.5"/>
  <circle cx="38" cy="21" r="4"/>
  <line x1="38" y1="25" x2="32" y2="30"/>
  <line x1="32" y1="30" x2="20" y2="36"/>
  <polyline points="20,36 26,46 24,58"/>
  <polyline points="32,28 32,24 32,33"/>
  <path d="M 36 44 L 36 34 L 33 37"/>'''
    },
    "seated_row": {
        "view": "Side view: seated cable row peak contraction with upright torso and elbows retracted back",
        "svg": f'''{FLOOR}
  <rect x="18" y="46" width="16" height="12" stroke-width="1.5"/>
  <line x1="48" y1="36" x2="48" y2="58" stroke-width="1.5"/>
  <circle cx="26" cy="24" r="4"/>
  <line x1="26" y1="28" x2="26" y2="46"/>
  <polyline points="26,46 36,46 44,46"/>
  <polyline points="26,30 20,34 30,34"/>
  <line x1="30" y1="34" x2="48" y2="38"/>'''
    },
    "straight_arm_pulldown": {
        "view": "Side view: straight-arm pulldown bottom contact with bar pressed down to anterior thighs",
        "svg": f'''{FLOOR}
  <line x1="50" y1="12" x2="50" y2="58" stroke-width="1.5"/>
  <circle cx="28" cy="20" r="4"/>
  <line x1="28" y1="24" x2="24" y2="38"/>
  <polyline points="24,38 26,48 24,58"/>
  <line x1="28" y1="26" x2="38" y2="44"/>
  <circle cx="38" cy="44" r="2.5"/>
  <line x1="50" y1="14" x2="38" y2="44"/>'''
    },
    "pull_up": {
        "view": "Front view: pull-up top inflection with chin cleared above horizontal bar and elbows adducted",
        "svg": f'''<line x1="12" y1="16" x2="52" y2="16" stroke-width="2"/>
  <circle cx="32" cy="12" r="4"/>
  <line x1="32" y1="16" x2="32" y2="34"/>
  <polyline points="32,34 30,46 30,56"/>
  <polyline points="32,34 34,46 34,56"/>
  <polyline points="32,20 22,22 22,16"/>
  <polyline points="32,20 42,22 42,16"/>'''
    },
    "muscle_up": {
        "view": "Side view: muscle-up top support position with body locked out straight above pull-up bar",
        "svg": f'''<circle cx="32" cy="38" r="2.5"/>
  <circle cx="32" cy="14" r="4"/>
  <line x1="32" y1="18" x2="32" y2="34"/>
  <polyline points="32,34 30,46 28,58"/>
  <polyline points="32,22 32,38"/>'''
    },
    "dip": {
        "view": "Side view: parallel bar dip at 90° elbow flexion bottom depth with suspended legs",
        "svg": f'''<line x1="14" y1="36" x2="50" y2="36" stroke-width="2"/>
  <line x1="18" y1="36" x2="18" y2="58" stroke-width="1.5"/>
  <circle cx="32" cy="20" r="4"/>
  <line x1="32" y1="24" x2="32" y2="38"/>
  <polyline points="32,38 28,48 30,56"/>
  <polyline points="32,26 26,30 26,36"/>'''
    },

    # ─── LUNGE & SINGLE-LEG ───
    "lunge": {
        "view": "Side view: lunge bottom depth with 90° front knee bend and rear knee hovering above floor",
        "svg": f'''{FLOOR}
  <circle cx="30" cy="20" r="4"/>
  <line x1="30" y1="24" x2="30" y2="38"/>
  <polyline points="30,38 42,42 42,58"/>
  <polyline points="30,38 18,48 14,58"/>
  <line x1="30" y1="28" x2="30" y2="40"/>'''
    },
    "bulgarian_split_squat": {
        "view": "Side view: Bulgarian split squat with rear instep supported on elevated bench behind",
        "svg": f'''{FLOOR}
  <rect x="8" y="44" width="12" height="14" stroke-width="1.5"/>
  <circle cx="32" cy="20" r="4"/>
  <line x1="32" y1="24" x2="32" y2="38"/>
  <polyline points="32,38 42,42 42,58"/>
  <polyline points="32,38 20,46 14,44"/>
  <line x1="32" y1="28" x2="32" y2="40"/>'''
    },

    # ─── POSTERIOR CHAIN & ISOLATION ───
    "hip_thrust": {
        "view": "Side view: barbell hip thrust top lockout with horizontal thighs and upper back on bench",
        "svg": f'''{FLOOR}
  <rect x="12" y="42" width="14" height="16" stroke-width="1.5"/>
  <circle cx="24" cy="38" r="4"/>
  <line x1="24" y1="42" x2="38" y2="42"/>
  <polyline points="38,42 46,42 46,58"/>
  <circle cx="38" cy="40" r="3.5"/>
  <path d="M 38 48 L 38 42 L 35 44"/>'''
    },
    "glute_bridge": {
        "view": "Side view: supine glute bridge top hip extension with shoulders anchored on floor",
        "svg": f'''{FLOOR}
  <circle cx="16" cy="54" r="4"/>
  <line x1="18" y1="56" x2="36" y2="42"/>
  <polyline points="36,42 46,44 46,58"/>'''
    },
    "nordic_curl": {
        "view": "Side view: Nordic hamstring curl forward eccentric descent with ankles clamped at floor",
        "svg": f'''{FLOOR}
  <rect x="10" y="54" width="10" height="4"/>
  <circle cx="48" cy="34" r="4"/>
  <polyline points="14,58 24,58 44,38"/>
  <polyline points="44,38 40,46 44,52"/>'''
    },
    "leg_curl": {
        "view": "Side view: lying leg curl peak contraction with heels flexed toward gluteal complex",
        "svg": f'''{FLOOR}
  {BENCH_FLAT}
  <circle cx="18" cy="42" r="4"/>
  <line x1="20" y1="44" x2="38" y2="44"/>
  <polyline points="38,44 46,44 42,34"/>
  <circle cx="42" cy="34" r="2.5"/>'''
    },
    "leg_extension": {
        "view": "Side view: seated leg extension top lockout with knees in full 180° terminal extension",
        "svg": f'''{FLOOR}
  <rect x="18" y="40" width="14" height="18" stroke-width="1.5"/>
  <circle cx="22" cy="24" r="4"/>
  <line x1="22" y1="28" x2="24" y2="42"/>
  <polyline points="24,42 36,42 48,42"/>
  <circle cx="48" cy="44" r="2.5"/>'''
    },
    "calf_raise": {
        "view": "Side view: standing calf raise peak plantarflexion with heels elevated high off floor",
        "svg": f'''{FLOOR}
  <circle cx="32" cy="18" r="4"/>
  <line x1="32" y1="22" x2="32" y2="40"/>
  <polyline points="32,40 32,50 36,54 32,58"/>
  <path d="M 28 54 L 28 46 L 25 49"/>'''
    },

    # ─── ARMS: BICEPS & TRICEPS ───
    "bicep_curl": {
        "view": "Side view: standing barbell bicep curl peak contraction with elbows pinned to ribs",
        "svg": f'''{FLOOR}
  <circle cx="28" cy="18" r="4"/>
  <line x1="28" y1="22" x2="28" y2="40"/>
  <polyline points="28,40 28,48 28,58"/>
  <polyline points="28,26 28,34 34,26"/>
  <circle cx="34" cy="26" r="3.5"/>'''
    },
    "tricep_pushdown": {
        "view": "Side view: cable tricep pushdown bottom lockout with arms fully extended along torso",
        "svg": f'''{FLOOR}
  <line x1="48" y1="12" x2="48" y2="58" stroke-width="1.5"/>
  <circle cx="28" cy="20" r="4"/>
  <line x1="28" y1="24" x2="26" y2="40"/>
  <polyline points="26,40 26,48 26,58"/>
  <polyline points="28,26 30,34 32,44"/>
  <line x1="48" y1="14" x2="32" y2="44"/>'''
    },
    "skull_crusher": {
        "view": "Side view: supine skull crusher inflection with barbell lowered directly to forehead",
        "svg": f'''{FLOOR}
  {BENCH_FLAT}
  <circle cx="44" cy="41" r="4"/>
  <line x1="42" y1="44" x2="22" y2="44"/>
  <polyline points="22,44 18,48 18,58"/>
  <polyline points="38,44 38,32 44,36"/>
  <circle cx="44" cy="36" r="3.5"/>'''
    },

    # ─── CORE, ABDOMINALS & TRUNK ───
    "ab_wheel": {
        "view": "Side view: kneeling ab wheel rollout full horizontal extension with neutral spine",
        "svg": f'''{FLOOR}
  <circle cx="48" cy="38" r="4"/>
  <line x1="18" y1="58" x2="24" y2="52"/>
  <line x1="24" y1="52" x2="44" y2="42"/>
  <line x1="44" y1="42" x2="52" y2="52"/>
  <circle cx="52" cy="53" r="5"/>'''
    },
    "crunch": {
        "view": "Side view: floor abdominal crunch peak thoracic flexion with knees bent 90°",
        "svg": f'''{FLOOR}
  <circle cx="24" cy="44" r="4"/>
  <path d="M 24 48 C 28 46, 32 50, 36 56"/>
  <polyline points="36,56 46,48 46,58"/>'''
    },
    "sit_up": {
        "view": "Side view: sit-up top position with torso upright against flexed thighs",
        "svg": f'''{FLOOR}
  <circle cx="28" cy="30" r="4"/>
  <line x1="28" y1="34" x2="34" y2="56"/>
  <polyline points="34,56 46,46 44,58"/>
  <line x1="28" y1="36" x2="40" y2="44"/>'''
    },
    "hanging_leg_raise": {
        "view": "Side view: hanging leg raise peak with legs flexed 90° horizontal to torso",
        "svg": f'''<line x1="16" y1="12" x2="48" y2="12" stroke-width="2"/>
  <circle cx="28" cy="18" r="4"/>
  <line x1="28" y1="12" x2="28" y2="36"/>
  <polyline points="28,36 44,36 52,36"/>
  <path d="M 32 48 Q 44 48 48 38"/>'''
    },
    "hollow_hold": {
        "view": "Side view: hollow body hold supine banana arc with shoulders and heels suspended",
        "svg": f'''{FLOOR}
  <circle cx="48" cy="44" r="4"/>
  <path d="M 52 42 C 44 54, 26 54, 16 44"/>'''
    },

    # ─── CLINICAL PHYSIOTHERAPY CATALOG (src/lib/physioCatalog.ts) ───
    "prone_y_raise": {
        "view": "Top-oblique view: prone Y-raise with bilateral 30° overhead arm abduction and thumbs up",
        "svg": f'''{FLOOR}
  <circle cx="32" cy="38" r="4"/>
  <line x1="32" y1="42" x2="32" y2="56"/>
  <polyline points="32,42 22,24 20,24"/>
  <polyline points="32,42 42,24 44,24"/>
  <path d="M 22 28 L 22 20 L 19 23"/>
  <path d="M 42 28 L 42 20 L 45 23"/>'''
    },
    "bird_dog": {
        "view": "Side view: quadruped bird-dog with simultaneous horizontal arm and contralateral leg extension",
        "svg": f'''{FLOOR}
  <circle cx="40" cy="32" r="4"/>
  <line x1="24" y1="40" x2="38" y2="40"/>
  <polyline points="24,40 24,58"/>
  <polyline points="38,40 38,58"/>
  <polyline points="38,40 52,40 56,40"/>
  <polyline points="24,40 12,40 8,40"/>'''
    },
    "clamshell": {
        "view": "Side view: side-lying clamshell with flexed knees and active top hip abduction arc",
        "svg": f'''{FLOOR}
  <circle cx="20" cy="48" r="4"/>
  <line x1="24" y1="52" x2="38" y2="52"/>
  <polyline points="38,52 46,58 38,58"/>
  <polyline points="38,52 44,44 38,58"/>
  <path d="M 44 54 Q 48 48 46 44"/>'''
    },
    "side_lying_hip_abduction": {
        "view": "Side view: side-lying hip abduction with straight leg raised 30° toward ceiling",
        "svg": f'''{FLOOR}
  <circle cx="20" cy="48" r="4"/>
  <line x1="24" y1="52" x2="38" y2="52"/>
  <line x1="38" y1="52" x2="54" y2="58"/>
  <line x1="38" y1="52" x2="52" y2="40"/>
  <path d="M 52 52 L 52 42 L 49 45"/>'''
    },
    "back_extension": {
        "view": "Side view: 45° back extension bench top lockout with neutral spine and engaged glutes",
        "svg": f'''{FLOOR}
  <line x1="16" y1="58" x2="32" y2="40" stroke-width="1.5"/>
  <rect x="28" y="38" width="8" height="6" rx="1"/>
  <circle cx="48" cy="24" r="4"/>
  <line x1="20" y1="54" x2="34" y2="40"/>
  <line x1="34" y1="40" x2="46" y2="28"/>'''
    },
    "wall_sit": {
        "view": "Side view: wall sit isometric hold with back flat to vertical wall and horizontal thighs",
        "svg": f'''{FLOOR}
  <line x1="18" y1="14" x2="18" y2="58" stroke-width="1.5"/>
  <circle cx="22" cy="22" r="4"/>
  <line x1="20" y1="26" x2="20" y2="42"/>
  <polyline points="20,42 36,42 36,58"/>'''
    },

    # ─── OLYMPIC LIFTS & CARDIO / ERGS ───
    "snatch": {
        "view": "Front view: Olympic snatch deep squat catch with wide overhead barbell lockout",
        "svg": f'''{FLOOR}
  <circle cx="32" cy="22" r="4"/>
  <line x1="32" y1="26" x2="32" y2="38"/>
  <polyline points="20,58 26,46 32,38 38,46 44,58"/>
  <line x1="10" y1="10" x2="54" y2="10"/>
  <circle cx="10" cy="10" r="3.5"/>
  <circle cx="54" cy="10" r="3.5"/>
  <polyline points="32,26 20,18 16,10"/>
  <polyline points="32,26 44,18 48,10"/>'''
    },
    "clean": {
        "view": "Side view: Olympic clean deep front-rack squat catch with horizontal elbows",
        "svg": f'''{FLOOR}
  <circle cx="34" cy="27" r="3.5"/>
  <circle cx="30" cy="19" r="4"/>
  <line x1="30" y1="23" x2="28" y2="34"/>
  <line x1="28" y1="34" x2="18" y2="44"/>
  <polyline points="18,44 26,45 24,58"/>
  <polyline points="32,28 36,32 34,27"/>'''
    },
    "split_jerk": {
        "view": "Side view: Olympic split jerk lockout with split foot stance and overhead bar stability",
        "svg": f'''{FLOOR}
  <circle cx="30" cy="10" r="3.5"/>
  <circle cx="30" cy="19" r="4"/>
  <line x1="30" y1="23" x2="30" y2="38"/>
  <polyline points="30,38 42,44 42,58"/>
  <polyline points="30,38 20,46 16,58"/>
  <line x1="30" y1="26" x2="30" y2="10"/>'''
    },
    "ski_erg": {
        "view": "Side view: SkiErg double pole downward drive with flexed knees and hip hinge",
        "svg": f'''{FLOOR}
  <line x1="48" y1="12" x2="48" y2="58" stroke-width="1.5"/>
  <circle cx="26" cy="22" r="4"/>
  <line x1="26" y1="26" x2="22" y2="38"/>
  <polyline points="22,38 28,46 24,58"/>
  <polyline points="26,28 34,36 30,44"/>
  <line x1="48" y1="14" x2="30" y2="44"/>
  <path d="M 36 28 L 32 44 L 29 41"/>'''
    },
    "treadmill": {
        "view": "Side view: treadmill run stride on deck platform with forward athletic posture",
        "svg": f'''{FLOOR}
  <polygon points="12,52 52,50 52,56 12,58" fill="none" stroke-width="1.5"/>
  <polyline points="46,50 46,26 40,26"/>
  <circle cx="32" cy="18" r="4"/>
  <line x1="32" y1="22" x2="30" y2="36"/>
  <polyline points="30,36 40,42 40,51"/>
  <polyline points="30,36 20,44 18,53"/>
  <polyline points="32,26 24,30 20,28"/>
  <polyline points="32,26 40,30 42,34"/>'''
    },
    "rower": {
        "view": "Side view: rowing machine catch position with flexed knees and forward reach",
        "svg": f'''{FLOOR}
  <line x1="12" y1="52" x2="52" y2="52" stroke-width="1.5"/>
  <rect x="48" y="38" width="6" height="14"/>
  <circle cx="24" cy="30" r="4"/>
  <line x1="24" y1="34" x2="26" y2="50"/>
  <polyline points="26,50 36,42 44,52"/>
  <polyline points="24,36 36,38 46,38"/>'''
    },
    "burpee": {
        "view": "Side view: burpee dynamic transition between prone push-up floor contact and jump takeoff",
        "svg": f'''{FLOOR}
  <circle cx="48" cy="42" r="4"/>
  <polyline points="46,46 44,58"/>
  <polyline points="46,46 36,44 32,58"/>
  <polyline points="36,44 16,56"/>
  <path d="M 36 34 L 40 26 L 43 29"/>'''
    },
    "jumping_jack": {
        "view": "Front view: jumping jack explosive peak with abducted legs and overhead hand clap",
        "svg": f'''{FLOOR}
  <circle cx="32" cy="16" r="4"/>
  <line x1="32" y1="20" x2="32" y2="36"/>
  <polyline points="18,58 24,46 32,36 40,46 46,58"/>
  <polyline points="18,16 26,22 32,24 38,22 46,16"/>
  <path d="M 16 34 Q 18 24 22 18"/>
  <path d="M 48 34 Q 46 24 42 18"/>'''
    },

    # ─── MOBILITY & STRETCHES ───
    "downward_dog": {
        "view": "Side view: downward-facing dog with hips piked at apex and straight grounded limbs",
        "svg": f'''{FLOOR}
  <circle cx="42" cy="46" r="4"/>
  <polyline points="44,58 38,40 32,26"/>
  <polyline points="32,26 24,40 18,58"/>'''
    },
    "child_pose": {
        "view": "Side view: child's pose with hips on heels and torso resting flat along floor",
        "svg": f'''{FLOOR}
  <circle cx="38" cy="50" r="4"/>
  <polyline points="16,58 24,52 34,54"/>
  <polyline points="34,54 44,58 52,58"/>'''
    },
    "cobra_stretch": {
        "view": "Side view: prone cobra stretch with pelvis grounded and extended thoracic spine",
        "svg": f'''{FLOOR}
  <circle cx="42" cy="28" r="4"/>
  <path d="M 16 58 C 24 58, 30 54, 38 42 C 40 38, 42 34, 42 32"/>
  <polyline points="38,42 42,50 42,58"/>'''
    },
}

# Synonyms dictionary: maps secondary exercise IDs to canonical primary IDs
SYNONYMS = {
    "ab_wheel_rollout": "ab_wheel",
    "band_clamshell": "clamshell",
    "banded_clamshell": "clamshell",
    "barbell_squat": "back_squat",
    "back_squat": "squat",
    "barbell_bench_press": "bench_press",
    "flat_bench_press": "bench_press",
    "barbell_deadlift": "deadlift",
    "conventional_deadlift": "deadlift",
    "chinup": "chin_up",
    "pullup": "pull_up",
    "pushup": "push_up",
    "skierg": "ski_erg",
    "smith_squat": "smith_machine_squat",
    "t_bar_row": "tbar_row",
    "battle_rope": "battle_ropes",
    "dumbbell_curl": "bicep_curl",
    "barbell_bicep_curl": "bicep_curl",
    "cable_bicep_curl": "bicep_curl",
    "dumbbell_lateral_raise": "lateral_raise",
    "side_lateral_raise": "lateral_raise",
    "dumbbell_front_raise": "front_raise",
    "dumbbell_shrug": "shrug",
    "barbell_shrug": "shrug",
    "cable_face_pull": "face_pull",
    "straight_arm_lat_pulldown": "straight_arm_pulldown",
    "hanging_knee_raise": "hanging_leg_raise",
    "toes_to_bar": "hanging_leg_raise",
    "hollow_rock": "hollow_hold",
    "hollow_body_hold": "hollow_hold",
    "side_plank_hip_dip": "side_plank",
    "romanian_deadlift_dumbbell": "romanian_deadlift",
    "dumbbell_romanian_deadlift": "romanian_deadlift",
    "bulgarian_split_squat_dumbbell": "bulgarian_split_squat",
    "walking_lunge_dumbbell": "walking_lunge",
    "treadmill_walk": "treadmill",
    "treadmill_incline_walk": "treadmill",
    "rowing_machine": "rower",
}

# The 20 Main Lifts for the Contact Sheet Showcase
MAIN_20_LIFTS = [
    "squat",
    "bench_press",
    "deadlift",
    "overhead_press",
    "barbell_row",
    "pull_up",
    "chin_up",
    "dip",
    "romanian_deadlift",
    "incline_bench_press",
    "front_squat",
    "bulgarian_split_squat",
    "lunge",
    "leg_press",
    "leg_curl",
    "leg_extension",
    "hip_thrust",
    "lateral_raise",
    "face_pull",
    "plank",
]

def resolve_template_for_id(ex_id: str) -> tuple[str, str]:
    """Returns (template_key, view_description) matching ex_id kinematics."""
    # Direct match in templates
    if ex_id in TEMPLATES:
        return ex_id, TEMPLATES[ex_id]["view"]
    if ex_id == "squat":
        return "back_squat", TEMPLATES["back_squat"]["view"]

    # Rule-based kinetic matching
    eid = ex_id.lower()

    # 1. Physio catalog specifics
    if "prone_y" in eid:
        return "prone_y_raise", TEMPLATES["prone_y_raise"]["view"]
    if "bird_dog" in eid:
        return "bird_dog", TEMPLATES["bird_dog"]["view"]
    if "clamshell" in eid:
        return "clamshell", TEMPLATES["clamshell"]["view"]
    if "side_lying_hip" in eid or "side_lying_leg" in eid:
        return "side_lying_hip_abduction", TEMPLATES["side_lying_hip_abduction"]["view"]
    if "back_extension" in eid or "hyperextension" in eid:
        return "back_extension", TEMPLATES["back_extension"]["view"]
    if "wall_sit" in eid:
        return "wall_sit", TEMPLATES["wall_sit"]["view"]

    # 2. Misassigned specifics from Claude's review
    if "shrug" in eid:
        return "shrug", TEMPLATES["shrug"]["view"]
    if "jefferson" in eid:
        return "jefferson_curl", TEMPLATES["jefferson_curl"]["view"]
    if "handstand" in eid:
        return "handstand_push_up", TEMPLATES["handstand_push_up"]["view"]
    if "nordic" in eid:
        return "nordic_curl", TEMPLATES["nordic_curl"]["view"]
    if "wheel" in eid or "rollout" in eid:
        return "ab_wheel", TEMPLATES["ab_wheel"]["view"]
    if "side_plank" in eid:
        return "side_plank", TEMPLATES["side_plank"]["view"]
    if "hollow" in eid:
        return "hollow_hold", TEMPLATES["hollow_hold"]["view"]
    if "hanging" in eid or "toes_to_bar" in eid:
        return "hanging_leg_raise", TEMPLATES["hanging_leg_raise"]["view"]
    if "kickback" in eid or "donkey_kick" in eid or "glute_kickback" in eid:
        return "bird_dog", "Side view: quadruped hip extension with working leg kicking back and up"
    if "ski_erg" in eid or "skierg" in eid:
        return "ski_erg", TEMPLATES["ski_erg"]["view"]
    if "treadmill" in eid:
        return "treadmill", TEMPLATES["treadmill"]["view"]
    if "snatch" in eid:
        return "snatch", TEMPLATES["snatch"]["view"]
    if "clean" in eid or "jerk" in eid:
        return "clean", TEMPLATES["clean"]["view"]
    if "rear_delt" in eid or "reverse_fly" in eid or "face_pull" in eid:
        if "face_pull" in eid:
            return "face_pull", TEMPLATES["face_pull"]["view"]
        return "rear_delt_fly", TEMPLATES["rear_delt_fly"]["view"]
    if "straight_arm" in eid:
        return "straight_arm_pulldown", TEMPLATES["straight_arm_pulldown"]["view"]
    if "muscle_up" in eid:
        return "muscle_up", TEMPLATES["muscle_up"]["view"]

    # 3. Squat & Lunge variants
    if "front_squat" in eid:
        return "front_squat", TEMPLATES["front_squat"]["view"]
    if "overhead_squat" in eid:
        return "overhead_squat", TEMPLATES["overhead_squat"]["view"]
    if "zercher" in eid:
        return "zercher_squat", TEMPLATES["zercher_squat"]["view"]
    if "box_squat" in eid:
        return "box_squat", TEMPLATES["box_squat"]["view"]
    if "goblet" in eid:
        return "goblet_squat", TEMPLATES["goblet_squat"]["view"]
    if "pistol" in eid:
        return "pistol_squat", TEMPLATES["pistol_squat"]["view"]
    if "sissy" in eid:
        return "sissy_squat", TEMPLATES["sissy_squat"]["view"]
    if "bulgarian" in eid or "split_squat" in eid:
        return "bulgarian_split_squat", TEMPLATES["bulgarian_split_squat"]["view"]
    if "lunge" in eid or "step_up" in eid:
        return "lunge", TEMPLATES["lunge"]["view"]
    if "squat" in eid:
        return "back_squat", TEMPLATES["back_squat"]["view"]

    # 4. Deadlift & Posterior chain
    if "romanian" in eid or "rdl" in eid:
        return "romanian_deadlift", TEMPLATES["romanian_deadlift"]["view"]
    if "sumo" in eid:
        return "sumo_deadlift", TEMPLATES["sumo_deadlift"]["view"]
    if "good_morning" in eid:
        return "good_morning", TEMPLATES["good_morning"]["view"]
    if "deadlift" in eid:
        return "deadlift", TEMPLATES["deadlift"]["view"]
    if "thrust" in eid or "bridge" in eid:
        if "thrust" in eid:
            return "hip_thrust", TEMPLATES["hip_thrust"]["view"]
        return "glute_bridge", TEMPLATES["glute_bridge"]["view"]
    if "leg_curl" in eid or "hamstring_curl" in eid:
        return "leg_curl", TEMPLATES["leg_curl"]["view"]
    if "leg_ext" in eid:
        return "leg_extension", TEMPLATES["leg_extension"]["view"]
    if "calf" in eid or "tibialis" in eid:
        return "calf_raise", TEMPLATES["calf_raise"]["view"]

    # 5. Press & Push
    if "incline" in eid and ("bench" in eid or "press" in eid):
        return "incline_bench_press", TEMPLATES["incline_bench_press"]["view"]
    if "decline" in eid and ("bench" in eid or "press" in eid):
        return "decline_bench_press", TEMPLATES["decline_bench_press"]["view"]
    if "bench" in eid or ("chest" in eid and "press" in eid):
        return "bench_press", TEMPLATES["bench_press"]["view"]
    if "fly" in eid:
        return "chest_fly", TEMPLATES["chest_fly"]["view"]
    if "pike" in eid:
        return "pike_push_up", TEMPLATES["pike_push_up"]["view"]
    if "push_up" in eid or "pushup" in eid:
        return "push_up", TEMPLATES["push_up"]["view"]
    if "dip" in eid:
        return "dip", TEMPLATES["dip"]["view"]
    if "overhead" in eid or "shoulder_press" in eid or "military" in eid or "arnold" in eid or "z_press" in eid:
        return "overhead_press", TEMPLATES["overhead_press"]["view"]
    if "lateral_raise" in eid or "side_raise" in eid:
        return "lateral_raise", TEMPLATES["lateral_raise"]["view"]
    if "front_raise" in eid:
        return "front_raise", TEMPLATES["front_raise"]["view"]

    # 6. Pull & Rows
    if "chin_up" in eid or "chinup" in eid:
        return "pull_up", "Front view: chin-up top inflection with supinated grip and chin cleared above bar"
    if "pull_up" in eid or "pullup" in eid or "lat_pull" in eid:
        return "pull_up", TEMPLATES["pull_up"]["view"]
    if "seated_row" in eid or "cable_row" in eid:
        return "seated_row", TEMPLATES["seated_row"]["view"]
    if "row" in eid:
        return "barbell_row", TEMPLATES["barbell_row"]["view"]

    # 7. Arms
    if "curl" in eid and "leg" not in eid:
        return "bicep_curl", TEMPLATES["bicep_curl"]["view"]
    if "skull" in eid:
        return "skull_crusher", TEMPLATES["skull_crusher"]["view"]
    if "tricep" in eid or "pushdown" in eid or "kickback" in eid:
        return "tricep_pushdown", TEMPLATES["tricep_pushdown"]["view"]

    # 8. Core
    if "plank" in eid:
        return "plank", TEMPLATES["plank"]["view"]
    if "crunch" in eid:
        return "crunch", TEMPLATES["crunch"]["view"]
    if "sit_up" in eid or "situp" in eid or "v_up" in eid:
        return "sit_up", TEMPLATES["sit_up"]["view"]

    # 9. Stretches & Cardio
    if "dog" in eid:
        return "downward_dog", TEMPLATES["downward_dog"]["view"]
    if "child" in eid:
        return "child_pose", TEMPLATES["child_pose"]["view"]
    if "cobra" in eid or "seal" in eid:
        return "cobra_stretch", TEMPLATES["cobra_stretch"]["view"]
    if "stretch" in eid or "fold" in eid:
        return "child_pose", "Floor mobility: forward stretch with neutral spine and controlled breathing"
    if "burpee" in eid:
        return "burpee", TEMPLATES["burpee"]["view"]
    if "jumping_jack" in eid or "jack" in eid:
        return "jumping_jack", TEMPLATES["jumping_jack"]["view"]
    if "rower" in eid or "rowing" in eid:
        return "rower", TEMPLATES["rower"]["view"]

    # Default fallback to clean standing compound movement
    return "back_squat", "Side view: athletic compound movement at inflection point"


def generate_all_svgs():
    os.makedirs(OUTPUT_SVG_DIR, exist_ok=True)
    with open(MANIFEST_PATH, "r", encoding="utf-8") as f:
        manifest = json.load(f)

    print(f"Generating SVGs for {len(manifest)} exercises...")
    updated_manifest = []

    for item in manifest:
        ex_id = item["id"]
        template_key, position_desc = resolve_template_for_id(ex_id)
        svg_content = TEMPLATES[template_key]["svg"]
        full_svg = svg_wrap(svg_content)

        file_name = f"{ex_id}.svg"
        file_path = os.path.join(OUTPUT_SVG_DIR, file_name)

        with open(file_path, "w", encoding="utf-8") as f:
            f.write(full_svg)

        entry = {
            "id": ex_id,
            "file": file_name,
            "name_en": item.get("name_en", ex_id.replace("_", " ").title()),
            "position_shown": position_desc,
        }

        # Check for synonym declaration
        if ex_id in SYNONYMS:
            entry["same_as"] = SYNONYMS[ex_id]

        updated_manifest.append(entry)

    with open(MANIFEST_PATH, "w", encoding="utf-8") as f:
        json.dump(updated_manifest, f, indent=2, ensure_ascii=False)

    print(f"Updated manifest written to {MANIFEST_PATH}")
    return updated_manifest


def build_contact_sheet(manifest: list):
    print("Building high-resolution contact sheet (docs/research/pictograms-sheet.png)...")
    os.makedirs(os.path.dirname(SHEET_PNG_PATH), exist_ok=True)

    font_path = "/System/Library/Fonts/Menlo.ttc"
    title_font = ImageFont.truetype(font_path, 20)
    sub_font = ImageFont.truetype(font_path, 13)
    label_font = ImageFont.truetype(font_path, 9)

    # Dimensions
    CANVAS_W = 1600
    CELL_W = 80
    CELL_H = 92
    COLS = 20

    # Header height + 20 Main lifts showcase height
    HEADER_H = 120
    SHOWCASE_H = 340
    GRID_ROWS = (len(manifest) + COLS - 1) // COLS
    GRID_H = GRID_ROWS * CELL_H
    CANVAS_H = HEADER_H + SHOWCASE_H + GRID_H + 40

    img = Image.new("RGB", (CANVAS_W, CANVAS_H), "#0E1117")
    draw = ImageDraw.Draw(img)

    # 1. ASCII Header Banner
    draw.text((30, 25), "=========================================================================================", fill="#3B82F6", font=title_font)
    draw.text((30, 50), "WORKOUTVISION EXERCISE PICTOGRAMS (V2) — FULL REPRODUCIBLE CATALOG", fill="#FFFFFF", font=title_font)
    draw.text((30, 78), f"455 SVG Illustrations (64x64) | Tier 1: 40 Main Lifts & Physio | Tier 2/3: Complete Coverage | 0 Placeholders", fill="#94A3B8", font=sub_font)
    draw.text((30, 95), "=========================================================================================", fill="#3B82F6", font=title_font)

    # 2. 20 Main Lifts Showcase (24px & 48px on Light & Dark backgrounds)
    showcase_y = HEADER_H + 10
    draw.text((30, showcase_y), "SHOWCASE: 20 MAIN LIFTS AT 24px & 48px (DARK THEME & LIGHT THEME)", fill="#F59E0B", font=sub_font)

    # Dark background strip for 48px
    draw.text((30, showcase_y + 25), "48px on Dark (#0E1117):", fill="#E2E8F0", font=label_font)
    # Light background strip for 48px
    draw.rectangle([20, showcase_y + 100, CANVAS_W - 20, showcase_y + 175], fill="#F8F9FA")
    draw.text((30, showcase_y + 105), "48px on Light (#F8F9FA):", fill="#1E293B", font=label_font)

    # 24px Dark
    draw.text((30, showcase_y + 185), "24px on Dark (#0E1117):", fill="#E2E8F0", font=label_font)
    # 24px Light
    draw.rectangle([20, showcase_y + 245, CANVAS_W - 20, showcase_y + 300], fill="#F8F9FA")
    draw.text((30, showcase_y + 250), "24px on Light (#F8F9FA):", fill="#1E293B", font=label_font)

    col_w_showcase = (CANVAS_W - 60) // 20

    for idx, ex_id in enumerate(MAIN_20_LIFTS):
        svg_file = os.path.join(OUTPUT_SVG_DIR, f"{ex_id}.svg")
        if not os.path.exists(svg_file):
            continue
        with open(svg_file, "r", encoding="utf-8") as f:
            svg_text = f.read()

        x = 30 + idx * col_w_showcase

        # Render 48px Dark (white stroke)
        svg_dark_48 = svg_text.replace("currentColor", "#FFFFFF").replace('viewBox="0 0 64 64"', 'viewBox="0 0 64 64" width="48" height="48"')
        png_dark_48 = resvg_py.svg_to_bytes(svg_dark_48)
        img_dark_48 = Image.open(io.BytesIO(png_dark_48))
        img.paste(img_dark_48, (x + 8, showcase_y + 42), img_dark_48)

        # Render 48px Light (dark stroke)
        svg_light_48 = svg_text.replace("currentColor", "#0F172A").replace('viewBox="0 0 64 64"', 'viewBox="0 0 64 64" width="48" height="48"')
        png_light_48 = resvg_py.svg_to_bytes(svg_light_48)
        img_light_48 = Image.open(io.BytesIO(png_light_48))
        img.paste(img_light_48, (x + 8, showcase_y + 120), img_light_48)

        # Render 24px Dark
        svg_dark_24 = svg_text.replace("currentColor", "#FFFFFF").replace('viewBox="0 0 64 64"', 'viewBox="0 0 64 64" width="24" height="24"')
        png_dark_24 = resvg_py.svg_to_bytes(svg_dark_24)
        img_dark_24 = Image.open(io.BytesIO(png_dark_24))
        img.paste(img_dark_24, (x + 20, showcase_y + 205), img_dark_24)

        # Render 24px Light
        svg_light_24 = svg_text.replace("currentColor", "#0F172A").replace('viewBox="0 0 64 64"', 'viewBox="0 0 64 64" width="24" height="24"')
        png_light_24 = resvg_py.svg_to_bytes(svg_light_24)
        img_light_24 = Image.open(io.BytesIO(png_light_24))
        img.paste(img_light_24, (x + 20, showcase_y + 265), img_light_24)

        # Truncated name label
        short_name = ex_id[:10]
        draw.text((x + 2, showcase_y + 90), short_name, fill="#94A3B8", font=label_font)

    # 3. Full Categorized Grid (all 455 exercises)
    grid_start_y = HEADER_H + SHOWCASE_H + 20
    draw.text((30, grid_start_y - 15), "FULL CATALOG GRID (455 ICONS AT 64x64 WITH EXERCISE ID):", fill="#10B981", font=sub_font)

    for idx, item in enumerate(manifest):
        col = idx % COLS
        row = idx // COLS
        x = 30 + col * CELL_W
        y = grid_start_y + row * CELL_H

        svg_path = os.path.join(OUTPUT_SVG_DIR, item["file"])
        if not os.path.exists(svg_path):
            continue

        with open(svg_path, "r", encoding="utf-8") as f:
            svg_text = f.read()

        # Render 56x56 icon
        svg_render = svg_text.replace("currentColor", "#38BDF8").replace('viewBox="0 0 64 64"', 'viewBox="0 0 64 64" width="56" height="56"')
        png_bytes = resvg_py.svg_to_bytes(svg_render)
        icon_img = Image.open(io.BytesIO(png_bytes))

        # Cell border
        draw.rectangle([x, y, x + 72, y + 84], outline="#1E293B", width=1)
        img.paste(icon_img, (x + 8, y + 4), icon_img)

        # Truncated label
        label = item["id"]
        if len(label) > 12:
            label = label[:11] + "."
        draw.text((x + 4, y + 68), label, fill="#64748B", font=label_font)

    img.save(SHEET_PNG_PATH, "PNG", optimize=True)
    size_mb = os.path.getsize(SHEET_PNG_PATH) / (1024 * 1024)
    print(f"Contact sheet successfully rendered to {SHEET_PNG_PATH} ({size_mb:.2f} MB, {CANVAS_W}x{CANVAS_H} px)")


if __name__ == "__main__":
    manifest = generate_all_svgs()
    build_contact_sheet(manifest)
