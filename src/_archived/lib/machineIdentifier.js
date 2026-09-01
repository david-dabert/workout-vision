/**
 * Gym machine / exercise identifier from photos.
 *
 * Uses a visual equipment catalog + pose-based classification.
 * When the user photographs a machine or themselves on it,
 * we analyze body position (if person visible) or match against
 * known equipment visual patterns.
 *
 * Strategy:
 * 1. If person is visible in the photo → run pose detection + angle analysis
 *    to classify the exercise (same logic as ExerciseAutoDetector but single-frame).
 * 2. If no person → show a visual equipment picker grouped by category.
 * 3. The identified exercise pre-selects in the video analysis dropdown.
 */

import { EXERCISES } from './exercises';

// Equipment catalog: maps machine/equipment names to exercise keys.
// Grouped by what a gym-goer would visually recognize.
export const EQUIPMENT_CATALOG = [
  {
    category: 'Cable machines',
    icon: '🔗',
    items: [
      { name: 'Lat pulldown machine', key: 'lat_pulldown' },
      { name: 'Seated cable row', key: 'seated_row' },
      { name: 'Cable crossover / fly', key: 'cable_fly' },
      { name: 'Tricep pushdown cable', key: 'tricep_pushdown' },
      { name: 'Face pull cable', key: 'face_pull' },
    ],
  },
  {
    category: 'Plate-loaded machines',
    icon: '🏋️',
    items: [
      { name: 'Leg press', key: 'leg_press' },
      { name: 'Hack squat machine', key: 'hack_squat' },
      { name: 'Chest press machine', key: 'machine_chest_press' },
      { name: 'Chest-supported row', key: 'chest_supported_row' },
      { name: 'Leg extension machine', key: 'leg_extension' },
      { name: 'Leg curl machine', key: 'leg_curl' },
      { name: 'Shoulder press machine', key: 'shoulder_press' },
      { name: 'Calf raise machine', key: 'calf_raise' },
    ],
  },
  {
    category: 'Free weights',
    icon: '💪',
    items: [
      { name: 'Barbell (squat rack)', key: 'squat' },
      { name: 'Barbell (bench press)', key: 'bench_press' },
      { name: 'Barbell (deadlift platform)', key: 'deadlift' },
      { name: 'Barbell (overhead press)', key: 'overhead_press' },
      { name: 'Barbell (bent over row)', key: 'bent_over_row' },
      { name: 'Barbell (front squat)', key: 'front_squat' },
      { name: 'Dumbbells (curl)', key: 'bicep_curl' },
      { name: 'Dumbbells (lateral raise)', key: 'lateral_raise' },
      { name: 'EZ bar (curl)', key: 'bicep_curl' },
      { name: 'Kettlebell', key: 'kettlebell_swing' },
    ],
  },
  {
    category: 'Bodyweight stations',
    icon: '🤸',
    items: [
      { name: 'Pull-up bar', key: 'pull_up' },
      { name: 'Chin-up bar', key: 'chin_up' },
      { name: 'Dip station', key: 'tricep_dip' },
      { name: 'Roman chair (back extension)', key: 'back_extension' },
      { name: 'Captain\'s chair (leg raise)', key: 'hanging_leg_raise' },
      { name: 'Inverted row rack / Smith machine', key: 'inverted_row' },
      { name: 'Plyo box', key: 'box_jump' },
      { name: 'GHD machine', key: 'glute_bridge' },
    ],
  },
  {
    category: 'Benches',
    icon: '🪑',
    items: [
      { name: 'Flat bench', key: 'bench_press' },
      { name: 'Incline bench', key: 'incline_press' },
      { name: 'Decline bench', key: 'bench_press' },
      { name: 'Preacher curl bench', key: 'bicep_curl' },
      { name: 'Hip thrust bench', key: 'hip_thrust' },
    ],
  },
  {
    category: 'Floor / no equipment',
    icon: '🧘',
    items: [
      { name: 'Push-ups', key: 'push_up' },
      { name: 'Diamond push-ups', key: 'diamond_push_up' },
      { name: 'Pike push-ups', key: 'pike_push_up' },
      { name: 'Burpees', key: 'burpee' },
      { name: 'Mountain climbers', key: 'mountain_climber' },
      { name: 'Jumping jacks', key: 'jumping_jack' },
      { name: 'Bodyweight squats / jump squats', key: 'jump_squat' },
      { name: 'Pistol squats', key: 'pistol_squat' },
      { name: 'Glute bridge', key: 'glute_bridge' },
      { name: 'Wall sit', key: 'wall_sit' },
      { name: 'Bear crawl', key: 'bear_crawl' },
      { name: 'Step-ups', key: 'step_up' },
      { name: 'Lunges', key: 'lunge' },
      { name: 'Romanian deadlift', key: 'romanian_deadlift' },
    ],
  },
  {
    category: 'Compound / supersets',
    icon: '⚡',
    items: [
      { name: 'Thruster (squat + press)', key: 'thruster' },
      { name: 'Clean and press', key: 'clean_and_press' },
      { name: 'Renegade row', key: 'renegade_row' },
      { name: 'Turkish get-up', key: 'turkish_get_up' },
      { name: 'Man maker', key: 'man_maker' },
      { name: 'Muscle-up', key: 'muscle_up' },
      { name: 'Superset (mixed)', key: 'superset' },
    ],
  },
];

/**
 * Filter the equipment catalog by search query.
 */
export function searchEquipment(query) {
  if (!query || query.trim().length === 0) return EQUIPMENT_CATALOG;

  const q = query.toLowerCase().trim();
  return EQUIPMENT_CATALOG.map(cat => ({
    ...cat,
    items: cat.items.filter(item =>
      item.name.toLowerCase().includes(q) ||
      (EXERCISES[item.key]?.name || '').toLowerCase().includes(q)
    ),
  })).filter(cat => cat.items.length > 0);
}
