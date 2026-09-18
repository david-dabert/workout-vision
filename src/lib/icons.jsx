/**
 * SVG icon library — replaces all Unicode emoji throughout the app.
 *
 * Every icon is a small inline SVG. No external dependencies.
 * Usage: <Icon name="crown" size={16} /> or ICON_MAP['crown'] for badge lookup.
 */

const svgPaths = {
  // ── Badges ──
  crown:       <path d="M2 17h20l-3-10-4 5-3-7-3 7-4-5z" fill="currentColor"/>,
  unlock:      <><rect x="5" y="11" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="2" fill="none"/><path d="M8 11V7a4 4 0 0 1 8 0" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round"/></>,
  hundred:     <><text x="12" y="17" textAnchor="middle" fontSize="14" fontWeight="800" fill="currentColor">100</text></>,
  star:        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 21 12 17.27 5.82 21 7 14.14l-5-4.87 6.91-1.01z" fill="currentColor"/>,
  chartUp:     <><polyline points="3 17 9 11 13 15 21 7" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/><polyline points="17 7 21 7 21 11" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></>,
  target:      <><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none"/><circle cx="12" cy="12" r="6" stroke="currentColor" strokeWidth="2" fill="none"/><circle cx="12" cy="12" r="2" fill="currentColor"/></>,
  scale:       <><path d="M12 3v18M3 7l9-4 9 4M5 7l3 7h-2a4 4 0 0 0 8 0h-2L9 7" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round"/><path d="M15 7l3 7h-2a4 4 0 0 0 8 0h-2l-3-7" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round"/></>,
  fire:        <path d="M12 23c-4.97 0-9-3.58-9-8 0-3.19 2.13-6.01 3.5-7.5.42-.46 1.17-.12 1.1.5-.17 1.38.2 2.85 1.4 3.5.56-2 2-4.5 4-6.5.39-.39 1.04-.1 1.02.44C14 7.5 14.5 9 16 10c.46-1.5 1-3.5 1-5 0-.44.55-.67.88-.38C20.12 6.52 21 9.5 21 12c0 6.08-4.03 11-9 11z" fill="currentColor"/>,
  snowflake:   <><line x1="12" y1="2" x2="12" y2="22" stroke="currentColor" strokeWidth="2"/><line x1="2" y1="12" x2="22" y2="12" stroke="currentColor" strokeWidth="2"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07" stroke="currentColor" strokeWidth="1.5"/><line x1="19.07" y1="4.93" x2="4.93" y2="19.07" stroke="currentColor" strokeWidth="1.5"/><line x1="12" y1="2" x2="14" y2="5" stroke="currentColor" strokeWidth="1.5"/><line x1="12" y1="2" x2="10" y2="5" stroke="currentColor" strokeWidth="1.5"/></>,
  muscle:      <path d="M7 4a3 3 0 0 1 3 3c0 1.5-1 3-2 4s-2 2.5-2 4a3 3 0 0 0 6 0c0-1-.5-2-1-3h2c.5 1 1 2 1 3a3 3 0 0 0 6 0c0-1.5-1-3-2-4s-2-2.5-2-4a3 3 0 0 1 3-3" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round"/>,
  globe:       <><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none"/><ellipse cx="12" cy="12" rx="4" ry="10" stroke="currentColor" strokeWidth="1.5" fill="none"/><line x1="2" y1="12" x2="22" y2="12" stroke="currentColor" strokeWidth="1.5"/></>,
  trophy:      <><path d="M6 9H3a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h3M18 9h3a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1h-3" stroke="currentColor" strokeWidth="2" fill="none"/><path d="M6 4h12v6a6 6 0 0 1-12 0V4z" stroke="currentColor" strokeWidth="2" fill="none"/><path d="M9 18h6M12 16v2M8 22h8" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round"/></>,
  gem:         <><path d="M6 3h12l4 6-10 12L2 9z" stroke="currentColor" strokeWidth="2" fill="none" strokeLinejoin="round"/><path d="M2 9h20M12 21L8 9l4-6 4 6z" stroke="currentColor" strokeWidth="1.5" fill="none"/></>,

  // ── Coaching / severity ──
  warning:     <><path d="M12 2L1 21h22z" stroke="currentColor" strokeWidth="2" fill="none" strokeLinejoin="round"/><line x1="12" y1="9" x2="12" y2="14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><circle cx="12" cy="17.5" r="1" fill="currentColor"/></>,
  arrowRight:  <><line x1="4" y1="12" x2="20" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><polyline points="14 6 20 12 14 18" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></>,
  check:       <polyline points="4 12 9 17 20 6" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>,
  info:        <><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none"/><line x1="12" y1="11" x2="12" y2="17" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><circle cx="12" cy="7.5" r="1" fill="currentColor"/></>,

  // ── Risk ──
  lightning:   <path d="M13 2L4 14h7l-2 8 9-12h-7z" fill="currentColor"/>,

  // ── Milestones ──
  flag:        <><path d="M4 2v20" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><path d="M4 4h12l-3 4 3 4H4" fill="currentColor" opacity="0.85"/></>,
  medal:       <><circle cx="12" cy="15" r="6" stroke="currentColor" strokeWidth="2" fill="none"/><path d="M8 3h8l-2 8.5M10 3l2 8.5" stroke="currentColor" strokeWidth="1.5" fill="none"/><circle cx="12" cy="15" r="2" fill="currentColor"/></>,

  // ── ExerciseSelector regions ──
  chest:       <path d="M12 4c-4 0-7 2-8 5-.5 1.5 0 3 1 4 1.5 1.5 3 2 5 2h4c2 0 3.5-.5 5-2 1-1 1.5-2.5 1-4-1-3-4-5-8-5z" stroke="currentColor" strokeWidth="2" fill="none"/>,
  back:        <><path d="M8 4v16M16 4v16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><path d="M5 8c2 1 4 1 7 0s5-1 7 0" stroke="currentColor" strokeWidth="1.5" fill="none"/><path d="M5 16c2-1 4-1 7 0s5 1 7 0" stroke="currentColor" strokeWidth="1.5" fill="none"/></>,
  shoulders:   <path d="M4 14c0-4 3-7 8-7s8 3 8 7M8 14v3M16 14v3" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round"/>,
  legs:        <><path d="M9 4v7l-2 9M15 4v7l2 9" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/></>,
  arms:        <path d="M6 7c2 0 3 1 3 3v4c0 1 .5 2 2 2M18 7c-2 0-3 1-3 3v4c0 1-.5 2-2 2" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round"/>,
  core:        <><rect x="7" y="4" width="10" height="16" rx="2" stroke="currentColor" strokeWidth="2" fill="none"/><line x1="7" y1="8" x2="17" y2="8" stroke="currentColor" strokeWidth="1.5"/><line x1="7" y1="12" x2="17" y2="12" stroke="currentColor" strokeWidth="1.5"/><line x1="7" y1="16" x2="17" y2="16" stroke="currentColor" strokeWidth="1.5"/><line x1="12" y1="4" x2="12" y2="20" stroke="currentColor" strokeWidth="1.5"/></>,
  fullBody:    <><circle cx="12" cy="4" r="2" stroke="currentColor" strokeWidth="1.5" fill="none"/><path d="M12 8v6M8 10h8M8 20l4-6 4 6" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></>,

  // ── Misc ──
  auto:        <><rect x="3" y="6" width="18" height="12" rx="2" stroke="currentColor" strokeWidth="2" fill="none"/><circle cx="9" cy="12" r="1.5" fill="currentColor"/><circle cx="15" cy="12" r="1.5" fill="currentColor"/><path d="M9 16c1.5 1 4.5 1 6 0" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round"/></>,
  weight:      <><rect x="2" y="9" width="4" height="6" rx="1" fill="currentColor"/><rect x="18" y="9" width="4" height="6" rx="1" fill="currentColor"/><rect x="5" y="7" width="3" height="10" rx="1" stroke="currentColor" strokeWidth="1.5" fill="none"/><rect x="16" y="7" width="3" height="10" rx="1" stroke="currentColor" strokeWidth="1.5" fill="none"/><line x1="8" y1="12" x2="16" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></>,
  repeat:      <><polyline points="17 1 21 5 17 9" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/><path d="M3 11V9a4 4 0 0 1 4-4h14" stroke="currentColor" strokeWidth="2" fill="none"/><polyline points="7 23 3 19 7 15" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/><path d="M21 13v2a4 4 0 0 1-4 4H3" stroke="currentColor" strokeWidth="2" fill="none"/></>,
  timer:       <><circle cx="12" cy="13" r="9" stroke="currentColor" strokeWidth="2" fill="none"/><polyline points="12 9 12 13 15 15" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round"/><path d="M9 1h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></>,
  barChart:    <><rect x="3" y="12" width="4" height="9" rx="1" fill="currentColor"/><rect x="10" y="6" width="4" height="15" rx="1" fill="currentColor"/><rect x="17" y="3" width="4" height="18" rx="1" fill="currentColor"/></>,
  ten:         <text x="12" y="17" textAnchor="middle" fontSize="14" fontWeight="800" fill="currentColor">10</text>,
};

/**
 * Render an SVG icon by name.
 * @param {object} props
 * @param {string} props.name - icon key from svgPaths
 * @param {number} [props.size=16] - width and height
 * @param {string} [props.color] - CSS color override
 * @param {string} [props.className]
 * @param {object} [props.style]
 */
export function Icon({ name, size = 16, color, className, style }) {
  const content = svgPaths[name];
  if (!content) return null;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ color, display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...style }}
      aria-hidden="true"
    >
      {content}
    </svg>
  );
}

/**
 * Badge icon key mapping — used by badges.js
 */
export const BADGE_ICON_KEY = {
  badge_perfect_form:    'crown',
  badge_new_exercise:    'unlock',
  badge_century_club:    'hundred',
  badge_a_grade:         'star',
  badge_form_breakthrough: 'chartUp',
  badge_iron_consistency: 'target',
  badge_symmetry_master: 'scale',
  badge_endurance_set:   'fire',
  badge_slow_controlled: 'snowflake',
  badge_full_rom:        'muscle',
  badge_comeback:        'chartUp',
  badge_explorer:        'globe',
  badge_variety_pack:    'trophy',
  badge_dedicated:       'gem',
};

/**
 * Milestone icon key mapping
 */
export const MILESTONE_ICON_KEY = {
  first_workout:         'flag',
  ten_workouts:          'ten',
  twenty_five_workouts:  'medal',
  fifty_workouts:        'trophy',
  first_a_grade:         'star',
  five_day_streak:       'fire',
  form_improved:         'chartUp',
};

/**
 * PR type icon key mapping
 */
export const PR_ICON_KEY = {
  heaviest:    'weight',
  most_reps:   'repeat',
  best_form:   'star',
  longest_set: 'timer',
  max_volume:  'barChart',
  streak:      'fire',
};

/**
 * Region icon key mapping for ExerciseSelector
 */
export const REGION_ICON_KEY = {
  Chest:       'chest',
  Back:        'back',
  Shoulders:   'shoulders',
  Legs:        'legs',
  Arms:        'arms',
  Core:        'core',
  'Full Body': 'fullBody',
};

/**
 * Coaching severity icon mapping
 */
export const SEVERITY_ICON_KEY = {
  warning:    'warning',
  correction: 'arrowRight',
  positive:   'check',
  info:       'info',
};

/**
 * Risk level icon mapping
 */
export const RISK_ICON_KEY = {
  low:      'check',
  moderate: 'warning',
  high:     'lightning',
};

/**
 * Draw an icon on a canvas context (for VideoReplay overlay and shareCard).
 * Uses simple geometric shapes instead of emoji text.
 */
export function drawCanvasIcon(ctx, name, x, y, size, color) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1, size / 10);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const s = size;
  const cx = x;
  const cy = y;
  const r = s / 2;

  switch (name) {
    case 'warning': {
      // Triangle with exclamation
      ctx.beginPath();
      ctx.moveTo(cx, cy - r);
      ctx.lineTo(cx + r, cy + r * 0.7);
      ctx.lineTo(cx - r, cy + r * 0.7);
      ctx.closePath();
      ctx.stroke();
      // Exclamation mark
      ctx.beginPath();
      ctx.moveTo(cx, cy - r * 0.3);
      ctx.lineTo(cx, cy + r * 0.15);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy + r * 0.4, s / 14, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'arrowRight': {
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.7, cy);
      ctx.lineTo(cx + r * 0.5, cy);
      ctx.moveTo(cx + r * 0.1, cy - r * 0.4);
      ctx.lineTo(cx + r * 0.5, cy);
      ctx.lineTo(cx + r * 0.1, cy + r * 0.4);
      ctx.stroke();
      break;
    }
    case 'check': {
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.5, cy);
      ctx.lineTo(cx - r * 0.1, cy + r * 0.4);
      ctx.lineTo(cx + r * 0.5, cy - r * 0.4);
      ctx.stroke();
      break;
    }
    case 'info': {
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.7, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx, cy - r * 0.05);
      ctx.lineTo(cx, cy + r * 0.35);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy - r * 0.3, s / 14, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    default: break;
  }
  ctx.restore();
}
