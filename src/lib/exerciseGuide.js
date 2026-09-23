/**
 * Exercise visual guide — maps our exercise keys to the bryllim/workout-guide
 * library for animated SVG illustrations.
 *
 * Source: https://github.com/bryllim/workout-guide (CC BY-SA 4.0)
 * 302 exercises with 3-frame SVG animations.
 *
 * CDN pattern: https://cdn.jsdelivr.net/npm/@bryllim/workout-guide@1.0.0/assets/{slug}/frame-{n}.svg
 */

const CDN_BASE = 'https://cdn.jsdelivr.net/npm/@bryllim/workout-guide@1.0.0/assets';

/**
 * Map our snake_case exercise keys to workout-guide kebab-case slugs.
 * Only exercises with a known visual match are listed.
 */
const KEY_TO_SLUG = {
  // Lower compound
  squat: 'barbell-back-squat',
  front_squat: 'front-squat',
  goblet_squat: 'goblet-squat',
  deadlift: 'deadlift',
  romanian_deadlift: 'romanian-deadlift',
  sumo_deadlift: 'sumo-deadlift',
  bulgarian_split_squat: 'bulgarian-split-squat',
  lunge: 'lunge',
  reverse_lunge: 'reverse-lunge',
  walking_lunge: 'walking-lunge',
  step_up: 'step-up',
  hip_thrust: 'hip-thrust',
  glute_bridge: 'glute-bridge',
  leg_press: 'leg-press',
  hack_squat: 'hack-squat',
  sissy_squat: 'sissy-squat',

  // Lower isolation
  leg_extension: 'leg-extension',
  leg_curl: 'leg-curl',
  seated_leg_curl: 'seated-leg-curl',
  calf_raise: 'standing-calf-raise',
  seated_calf_raise: 'seated-calf-raise',

  // Upper push compound
  bench_press: 'bench-press',
  incline_bench_press: 'incline-bench-press',
  decline_bench_press: 'decline-bench-press',
  dumbbell_bench_press: 'dumbbell-bench-press',
  flat_dumbbell_press: 'dumbbell-bench-press',
  incline_dumbbell_press: 'incline-dumbbell-press',
  overhead_press: 'overhead-press',
  dumbbell_shoulder_press: 'dumbbell-shoulder-press',
  machine_shoulder_press: 'machine-shoulder-press',
  push_up: 'push-up',
  diamond_push_up: 'diamond-push-up',
  pike_push_up: 'pike-push-up',
  deficit_push_up: 'deficit-push-up',
  dip: 'dip',

  // Upper push isolation
  lateral_raise: 'lateral-raise',
  front_raise: 'front-raise',
  dumbbell_fly: 'dumbbell-fly',
  cable_fly: 'cable-fly',
  pec_deck: 'pec-deck',
  tricep_extension: 'tricep-extension',
  cable_tricep_pushdown: 'cable-tricep-pushdown',
  machine_tricep_extension: 'machine-tricep-extension',
  skull_crusher: 'skull-crusher',

  // Upper pull compound
  pull_up: 'pull-up',
  chin_up: 'chin-up',
  assisted_pull_up: 'assisted-pull-up',
  lat_pulldown: 'lat-pulldown',
  bent_over_row: 'bent-over-row',
  dumbbell_row: 'dumbbell-row',
  seated_row: 'seated-row',
  cable_row: 'cable-row',
  t_bar_row: 't-bar-row',
  upright_row: 'upright-row',
  face_pull: 'face-pull',

  // Upper pull isolation
  bicep_curl: 'bicep-curl',
  hammer_curl: 'hammer-curl',
  ez_bar_curl: 'ez-bar-curl',
  concentration_curl: 'concentration-curl',
  preacher_curl: 'preacher-curl',
  incline_curl: 'incline-dumbbell-curl',
  reverse_curl: 'reverse-curl',

  // Core
  crunch: 'crunch',
  sit_up: 'sit-up',
  plank: 'plank',
  mountain_climber: 'mountain-climber',
  russian_twist: 'russian-twist',
  leg_raise: 'leg-raise',
  hanging_leg_raise: 'hanging-leg-raise',

  // Bodyweight
  jumping_jack: 'jumping-jack',
  burpee: 'burpee',
  box_jump: 'box-jump',

  // Full body / Olympic
  clean_and_press: 'clean-and-press',
  kettlebell_swing: 'kettlebell-swing',
};

// ---------------------------------------------------------------------------
// GUIDE_EXERCISES: complete catalogue of all 302 exercises from the library.
// Each entry: { name, slug, category }
// Keys that match our EXERCISES dictionary use the same snake_case key.
// Others are derived from the slug (kebab-case to snake_case).
// ---------------------------------------------------------------------------

const GUIDE_EXERCISES = {
  // -- ab-wheel
  ab_wheel: { name: 'Ab Wheel', slug: 'ab-wheel', category: 'core' },
  // -- active-hang
  active_hang: { name: 'Active Hang', slug: 'active-hang', category: 'back' },
  // -- archer-push-up
  archer_push_up: { name: 'Archer Push Up', slug: 'archer-push-up', category: 'chest' },
  // -- arm-circles
  arm_circles: { name: 'Arm Circles', slug: 'arm-circles', category: 'shoulders' },
  // -- arnold-press
  arnold_press: { name: 'Arnold Press', slug: 'arnold-press', category: 'shoulders' },
  // -- assault-bike
  assault_bike: { name: 'Assault Bike', slug: 'assault-bike', category: 'cardio' },
  // -- assisted-chin-up
  assisted_chin_up: { name: 'Assisted Chin Up', slug: 'assisted-chin-up', category: 'back' },
  // -- assisted-dip
  assisted_dip: { name: 'Assisted Dip', slug: 'assisted-dip', category: 'chest' },
  // -- assisted-pistol-squat
  assisted_pistol_squat: { name: 'Assisted Pistol Squat', slug: 'assisted-pistol-squat', category: 'legs' },
  // -- assisted-pull-up
  assisted_pull_up: { name: 'Assisted Pull Up', slug: 'assisted-pull-up', category: 'back' },
  // -- back-extension
  back_extension: { name: 'Back Extension', slug: 'back-extension', category: 'back' },
  // -- band-pull-apart
  band_pull_apart: { name: 'Band Pull Apart', slug: 'band-pull-apart', category: 'shoulders' },
  // -- banded-clamshell
  banded_clamshell: { name: 'Banded Clamshell', slug: 'banded-clamshell', category: 'legs' },
  // -- banded-dead-bug
  banded_dead_bug: { name: 'Banded Dead Bug', slug: 'banded-dead-bug', category: 'core' },
  // -- banded-donkey-kick
  banded_donkey_kick: { name: 'Banded Donkey Kick', slug: 'banded-donkey-kick', category: 'legs' },
  // -- banded-face-pull
  banded_face_pull: { name: 'Banded Face Pull', slug: 'banded-face-pull', category: 'shoulders' },
  // -- banded-fire-hydrant
  banded_fire_hydrant: { name: 'Banded Fire Hydrant', slug: 'banded-fire-hydrant', category: 'legs' },
  // -- banded-frog-pump
  banded_frog_pump: { name: 'Banded Frog Pump', slug: 'banded-frog-pump', category: 'legs' },
  // -- banded-glute-bridge
  banded_glute_bridge: { name: 'Banded Glute Bridge', slug: 'banded-glute-bridge', category: 'legs' },
  // -- banded-hip-thrust
  banded_hip_thrust: { name: 'Banded Hip Thrust', slug: 'banded-hip-thrust', category: 'legs' },
  // -- banded-kickback
  banded_kickback: { name: 'Banded Kickback', slug: 'banded-kickback', category: 'legs' },
  // -- banded-lat-pulldown
  banded_lat_pulldown: { name: 'Banded Lat Pulldown', slug: 'banded-lat-pulldown', category: 'back' },
  // -- banded-lateral-walk
  banded_lateral_walk: { name: 'Banded Lateral Walk', slug: 'banded-lateral-walk', category: 'legs' },
  // -- banded-monster-walk
  banded_monster_walk: { name: 'Banded Monster Walk', slug: 'banded-monster-walk', category: 'legs' },
  // -- banded-pallof-press
  banded_pallof_press: { name: 'Banded Pallof Press', slug: 'banded-pallof-press', category: 'core' },
  // -- banded-row
  banded_row: { name: 'Banded Row', slug: 'banded-row', category: 'back' },
  // -- banded-seated-hip-abduction
  banded_seated_hip_abduction: { name: 'Banded Seated Hip Abduction', slug: 'banded-seated-hip-abduction', category: 'legs' },
  // -- banded-squat
  banded_squat: { name: 'Banded Squat', slug: 'banded-squat', category: 'legs' },
  // -- banded-standing-hip-abduction
  banded_standing_hip_abduction: { name: 'Banded Standing Hip Abduction', slug: 'banded-standing-hip-abduction', category: 'legs' },
  // -- banded-woodchop
  banded_woodchop: { name: 'Banded Woodchop', slug: 'banded-woodchop', category: 'core' },
  // -- barbell-glute-bridge
  barbell_glute_bridge: { name: 'Barbell Glute Bridge', slug: 'barbell-glute-bridge', category: 'legs' },
  // -- barbell-row
  barbell_row: { name: 'Barbell Row', slug: 'barbell-row', category: 'back' },
  // -- battle-ropes
  battle_ropes: { name: 'Battle Ropes', slug: 'battle-ropes', category: 'full_body' },
  // -- bear-crawl
  bear_crawl: { name: 'Bear Crawl', slug: 'bear-crawl', category: 'full_body' },
  // -- bear-plank
  bear_plank: { name: 'Bear Plank', slug: 'bear-plank', category: 'core' },
  // -- belt-squat
  belt_squat: { name: 'Belt Squat', slug: 'belt-squat', category: 'legs' },
  // -- bench-dip
  bench_dip: { name: 'Bench Dip', slug: 'bench-dip', category: 'arms' },
  // -- bench-press
  bench_press: { name: 'Bench Press', slug: 'bench-press', category: 'chest' },
  // -- bent-over-rear-delt-raise
  bent_over_rear_delt_raise: { name: 'Bent Over Rear Delt Raise', slug: 'bent-over-rear-delt-raise', category: 'shoulders' },
  // -- bicep-curl
  bicep_curl: { name: 'Bicep Curl', slug: 'bicep-curl', category: 'arms' },
  // -- bicycle-crunch
  bicycle_crunch: { name: 'Bicycle Crunch', slug: 'bicycle-crunch', category: 'core' },
  // -- bird-dog
  bird_dog: { name: 'Bird Dog', slug: 'bird-dog', category: 'core' },
  // -- bodyweight-squat
  bodyweight_squat: { name: 'Bodyweight Squat', slug: 'bodyweight-squat', category: 'legs' },
  // -- bulgarian-split-squat
  bulgarian_split_squat: { name: 'Bulgarian Split Squat', slug: 'bulgarian-split-squat', category: 'legs' },
  // -- burpee
  burpee: { name: 'Burpee', slug: 'burpee', category: 'full_body' },
  // -- butterfly-stretch
  butterfly_stretch: { name: 'Butterfly Stretch', slug: 'butterfly-stretch', category: 'stretching' },
  // -- cable-crunch
  cable_crunch: { name: 'Cable Crunch', slug: 'cable-crunch', category: 'core' },
  // -- cable-curl
  cable_curl: { name: 'Cable Curl', slug: 'cable-curl', category: 'arms' },
  // -- cable-fly
  cable_fly: { name: 'Cable Fly', slug: 'cable-fly', category: 'chest' },
  // -- cable-front-raise
  cable_front_raise: { name: 'Cable Front Raise', slug: 'cable-front-raise', category: 'shoulders' },
  // -- cable-kickback
  cable_kickback: { name: 'Cable Kickback', slug: 'cable-kickback', category: 'arms' },
  // -- cable-lateral-raise
  cable_lateral_raise: { name: 'Cable Lateral Raise', slug: 'cable-lateral-raise', category: 'shoulders' },
  // -- cable-pallof-hold
  cable_pallof_hold: { name: 'Cable Pallof Hold', slug: 'cable-pallof-hold', category: 'core' },
  // -- cable-pull-through
  cable_pull_through: { name: 'Cable Pull Through', slug: 'cable-pull-through', category: 'legs' },
  // -- cable-rear-delt-fly
  cable_rear_delt_fly: { name: 'Cable Rear Delt Fly', slug: 'cable-rear-delt-fly', category: 'shoulders' },
  // -- cable-standing-hip-abduction
  cable_standing_hip_abduction: { name: 'Cable Standing Hip Abduction', slug: 'cable-standing-hip-abduction', category: 'legs' },
  // -- cable-standing-hip-adduction
  cable_standing_hip_adduction: { name: 'Cable Standing Hip Adduction', slug: 'cable-standing-hip-adduction', category: 'legs' },
  // -- cable-woodchop
  cable_woodchop: { name: 'Cable Woodchop', slug: 'cable-woodchop', category: 'core' },
  // -- calf-raise
  calf_raise: { name: 'Calf Raise', slug: 'calf-raise', category: 'legs' },
  // -- captains-chair-knee-raise
  captains_chair_knee_raise: { name: 'Captains Chair Knee Raise', slug: 'captains-chair-knee-raise', category: 'core' },
  // -- cat-cow-stretch
  cat_cow_stretch: { name: 'Cat Cow Stretch', slug: 'cat-cow-stretch', category: 'stretching' },
  // -- chair-dip
  chair_dip: { name: 'Chair Dip', slug: 'chair-dip', category: 'arms' },
  // -- chest-dip
  chest_dip: { name: 'Chest Dip', slug: 'chest-dip', category: 'chest' },
  // -- chest-supported-row
  chest_supported_row: { name: 'Chest Supported Row', slug: 'chest-supported-row', category: 'back' },
  // -- childs-pose
  childs_pose: { name: 'Childs Pose', slug: 'childs-pose', category: 'stretching' },
  // -- chin-up
  chin_up: { name: 'Chin Up', slug: 'chin-up', category: 'back' },
  // -- clamshell
  clamshell: { name: 'Clamshell', slug: 'clamshell', category: 'legs' },
  // -- close-grip-bench-press
  close_grip_bench_press: { name: 'Close Grip Bench Press', slug: 'close-grip-bench-press', category: 'chest' },
  // -- close-grip-lat-pulldown
  close_grip_lat_pulldown: { name: 'Close Grip Lat Pulldown', slug: 'close-grip-lat-pulldown', category: 'back' },
  // -- commando-pull-up
  commando_pull_up: { name: 'Commando Pull Up', slug: 'commando-pull-up', category: 'back' },
  // -- concentration-curl
  concentration_curl: { name: 'Concentration Curl', slug: 'concentration-curl', category: 'arms' },
  // -- copenhagen-plank
  copenhagen_plank: { name: 'Copenhagen Plank', slug: 'copenhagen-plank', category: 'core' },
  // -- cossack-squat
  cossack_squat: { name: 'Cossack Squat', slug: 'cossack-squat', category: 'legs' },
  // -- crab-walk
  crab_walk: { name: 'Crab Walk', slug: 'crab-walk', category: 'full_body' },
  // -- cross-body-shoulder-stretch
  cross_body_shoulder_stretch: { name: 'Cross Body Shoulder Stretch', slug: 'cross-body-shoulder-stretch', category: 'stretching' },
  // -- crunch
  crunch: { name: 'Crunch', slug: 'crunch', category: 'core' },
  // -- curtsy-lunge
  curtsy_lunge: { name: 'Curtsy Lunge', slug: 'curtsy-lunge', category: 'legs' },
  // -- cycling
  cycling: { name: 'Cycling', slug: 'cycling', category: 'cardio' },
  // -- dead-bug
  dead_bug: { name: 'Dead Bug', slug: 'dead-bug', category: 'core' },
  // -- dead-hang
  dead_hang: { name: 'Dead Hang', slug: 'dead-hang', category: 'back' },
  // -- deadlift
  deadlift: { name: 'Deadlift', slug: 'deadlift', category: 'legs' },
  // -- decline-bench-press
  decline_bench_press: { name: 'Decline Bench Press', slug: 'decline-bench-press', category: 'chest' },
  // -- decline-dumbbell-press
  decline_dumbbell_press: { name: 'Decline Dumbbell Press', slug: 'decline-dumbbell-press', category: 'chest' },
  // -- decline-push-up
  decline_push_up: { name: 'Decline Push Up', slug: 'decline-push-up', category: 'chest' },
  // -- decline-sit-up
  decline_sit_up: { name: 'Decline Sit Up', slug: 'decline-sit-up', category: 'core' },
  // -- deficit-reverse-lunge
  deficit_reverse_lunge: { name: 'Deficit Reverse Lunge', slug: 'deficit-reverse-lunge', category: 'legs' },
  // -- diamond-push-up
  diamond_push_up: { name: 'Diamond Push Up', slug: 'diamond-push-up', category: 'chest' },
  // -- dip
  dip: { name: 'Dip', slug: 'dip', category: 'chest' },
  // -- donkey-calf-raise
  donkey_calf_raise: { name: 'Donkey Calf Raise', slug: 'donkey-calf-raise', category: 'legs' },
  // -- donkey-kick
  donkey_kick: { name: 'Donkey Kick', slug: 'donkey-kick', category: 'legs' },
  // -- doorway-chest-stretch
  doorway_chest_stretch: { name: 'Doorway Chest Stretch', slug: 'doorway-chest-stretch', category: 'stretching' },
  // -- doorway-row
  doorway_row: { name: 'Doorway Row', slug: 'doorway-row', category: 'back' },
  // -- drag-curl
  drag_curl: { name: 'Drag Curl', slug: 'drag-curl', category: 'arms' },
  // -- dragon-flag
  dragon_flag: { name: 'Dragon Flag', slug: 'dragon-flag', category: 'core' },
  // -- dumbbell-bench-press
  dumbbell_bench_press: { name: 'Dumbbell Bench Press', slug: 'dumbbell-bench-press', category: 'chest' },
  // -- dumbbell-bent-over-row
  dumbbell_bent_over_row: { name: 'Dumbbell Bent Over Row', slug: 'dumbbell-bent-over-row', category: 'back' },
  // -- dumbbell-curtsy-lunge
  dumbbell_curtsy_lunge: { name: 'Dumbbell Curtsy Lunge', slug: 'dumbbell-curtsy-lunge', category: 'legs' },
  // -- dumbbell-fly
  dumbbell_fly: { name: 'Dumbbell Fly', slug: 'dumbbell-fly', category: 'chest' },
  // -- dumbbell-glute-bridge
  dumbbell_glute_bridge: { name: 'Dumbbell Glute Bridge', slug: 'dumbbell-glute-bridge', category: 'legs' },
  // -- dumbbell-hip-thrust
  dumbbell_hip_thrust: { name: 'Dumbbell Hip Thrust', slug: 'dumbbell-hip-thrust', category: 'legs' },
  // -- dumbbell-lateral-lunge
  dumbbell_lateral_lunge: { name: 'Dumbbell Lateral Lunge', slug: 'dumbbell-lateral-lunge', category: 'legs' },
  // -- dumbbell-overhead-tricep-extension
  dumbbell_overhead_tricep_extension: { name: 'Dumbbell Overhead Tricep Extension', slug: 'dumbbell-overhead-tricep-extension', category: 'arms' },
  // -- dumbbell-romanian-deadlift
  dumbbell_romanian_deadlift: { name: 'Dumbbell Romanian Deadlift', slug: 'dumbbell-romanian-deadlift', category: 'legs' },
  // -- dumbbell-shrug
  dumbbell_shrug: { name: 'Dumbbell Shrug', slug: 'dumbbell-shrug', category: 'shoulders' },
  // -- dumbbell-side-bend
  dumbbell_side_bend: { name: 'Dumbbell Side Bend', slug: 'dumbbell-side-bend', category: 'core' },
  // -- dumbbell-skull-crusher
  dumbbell_skull_crusher: { name: 'Dumbbell Skull Crusher', slug: 'dumbbell-skull-crusher', category: 'arms' },
  // -- dumbbell-sumo-deadlift
  dumbbell_sumo_deadlift: { name: 'Dumbbell Sumo Deadlift', slug: 'dumbbell-sumo-deadlift', category: 'legs' },
  // -- dumbbell-sumo-squat
  dumbbell_sumo_squat: { name: 'Dumbbell Sumo Squat', slug: 'dumbbell-sumo-squat', category: 'legs' },
  // -- elliptical
  elliptical: { name: 'Elliptical', slug: 'elliptical', category: 'cardio' },
  // -- explosive-push-up
  explosive_push_up: { name: 'Explosive Push Up', slug: 'explosive-push-up', category: 'chest' },
  // -- ez-bar-curl
  ez_bar_curl: { name: 'Ez Bar Curl', slug: 'ez-bar-curl', category: 'arms' },
  // -- face-pull
  face_pull: { name: 'Face Pull', slug: 'face-pull', category: 'shoulders' },
  // -- farmer-carry
  farmer_carry: { name: 'Farmer Carry', slug: 'farmer-carry', category: 'full_body' },
  // -- fast-feet
  fast_feet: { name: 'Fast Feet', slug: 'fast-feet', category: 'cardio' },
  // -- feet-elevated-pike-push-up
  feet_elevated_pike_push_up: { name: 'Feet Elevated Pike Push Up', slug: 'feet-elevated-pike-push-up', category: 'shoulders' },
  // -- fire-hydrant
  fire_hydrant: { name: 'Fire Hydrant', slug: 'fire-hydrant', category: 'legs' },
  // -- flutter-kick
  flutter_kick: { name: 'Flutter Kick', slug: 'flutter-kick', category: 'core' },
  // -- forward-lunge
  forward_lunge: { name: 'Forward Lunge', slug: 'forward-lunge', category: 'legs' },
  // -- frog-pump
  frog_pump: { name: 'Frog Pump', slug: 'frog-pump', category: 'legs' },
  // -- front-foot-elevated-split-squat
  front_foot_elevated_split_squat: { name: 'Front Foot Elevated Split Squat', slug: 'front-foot-elevated-split-squat', category: 'legs' },
  // -- front-raise
  front_raise: { name: 'Front Raise', slug: 'front-raise', category: 'shoulders' },
  // -- front-squat
  front_squat: { name: 'Front Squat', slug: 'front-squat', category: 'legs' },
  // -- glute-bridge
  glute_bridge: { name: 'Glute Bridge', slug: 'glute-bridge', category: 'legs' },
  // -- glute-bridge-march
  glute_bridge_march: { name: 'Glute Bridge March', slug: 'glute-bridge-march', category: 'legs' },
  // -- glute-focused-back-extension
  glute_focused_back_extension: { name: 'Glute Focused Back Extension', slug: 'glute-focused-back-extension', category: 'legs' },
  // -- goblet-squat
  goblet_squat: { name: 'Goblet Squat', slug: 'goblet-squat', category: 'legs' },
  // -- good-morning
  good_morning: { name: 'Good Morning', slug: 'good-morning', category: 'back' },
  // -- hack-squat
  hack_squat: { name: 'Hack Squat', slug: 'hack-squat', category: 'legs' },
  // -- half-burpee
  half_burpee: { name: 'Half Burpee', slug: 'half-burpee', category: 'full_body' },
  // -- half-kneeling-pallof-press
  half_kneeling_pallof_press: { name: 'Half Kneeling Pallof Press', slug: 'half-kneeling-pallof-press', category: 'core' },
  // -- hammer-curl
  hammer_curl: { name: 'Hammer Curl', slug: 'hammer-curl', category: 'arms' },
  // -- hamstring-stretch
  hamstring_stretch: { name: 'Hamstring Stretch', slug: 'hamstring-stretch', category: 'stretching' },
  // -- handstand-push-up
  handstand_push_up: { name: 'Handstand Push Up', slug: 'handstand-push-up', category: 'shoulders' },
  // -- hanging-knee-raise
  hanging_knee_raise: { name: 'Hanging Knee Raise', slug: 'hanging-knee-raise', category: 'core' },
  // -- hanging-leg-raise
  hanging_leg_raise: { name: 'Hanging Leg Raise', slug: 'hanging-leg-raise', category: 'core' },
  // -- heel-elevated-goblet-squat
  heel_elevated_goblet_squat: { name: 'Heel Elevated Goblet Squat', slug: 'heel-elevated-goblet-squat', category: 'legs' },
  // -- heel-tap
  heel_tap: { name: 'Heel Tap', slug: 'heel-tap', category: 'core' },
  // -- high-knees
  high_knees: { name: 'High Knees', slug: 'high-knees', category: 'cardio' },
  // -- hiking
  hiking: { name: 'Hiking', slug: 'hiking', category: 'cardio' },
  // -- hindu-push-up
  hindu_push_up: { name: 'Hindu Push Up', slug: 'hindu-push-up', category: 'chest' },
  // -- hip-abduction-machine
  hip_abduction_machine: { name: 'Hip Abduction Machine', slug: 'hip-abduction-machine', category: 'legs' },
  // -- hip-adduction-machine
  hip_adduction_machine: { name: 'Hip Adduction Machine', slug: 'hip-adduction-machine', category: 'legs' },
  // -- hip-airplane
  hip_airplane: { name: 'Hip Airplane', slug: 'hip-airplane', category: 'legs' },
  // -- hip-thrust
  hip_thrust: { name: 'Hip Thrust', slug: 'hip-thrust', category: 'legs' },
  // -- hollow-body-hold
  hollow_body_hold: { name: 'Hollow Body Hold', slug: 'hollow-body-hold', category: 'core' },
  // -- hollow-rock
  hollow_rock: { name: 'Hollow Rock', slug: 'hollow-rock', category: 'core' },
  // -- inchworm
  inchworm: { name: 'Inchworm', slug: 'inchworm', category: 'full_body' },
  // -- incline-bench-press
  incline_bench_press: { name: 'Incline Bench Press', slug: 'incline-bench-press', category: 'chest' },
  // -- incline-cable-fly
  incline_cable_fly: { name: 'Incline Cable Fly', slug: 'incline-cable-fly', category: 'chest' },
  // -- incline-dumbbell-curl
  incline_dumbbell_curl: { name: 'Incline Dumbbell Curl', slug: 'incline-dumbbell-curl', category: 'arms' },
  // -- incline-dumbbell-press
  incline_dumbbell_press: { name: 'Incline Dumbbell Press', slug: 'incline-dumbbell-press', category: 'chest' },
  // -- incline-push-up
  incline_push_up: { name: 'Incline Push Up', slug: 'incline-push-up', category: 'chest' },
  // -- inverted-row
  inverted_row: { name: 'Inverted Row', slug: 'inverted-row', category: 'back' },
  // -- jump-rope
  jump_rope: { name: 'Jump Rope', slug: 'jump-rope', category: 'cardio' },
  // -- jump-squat
  jump_squat: { name: 'Jump Squat', slug: 'jump-squat', category: 'legs' },
  // -- jumping-jack
  jumping_jack: { name: 'Jumping Jack', slug: 'jumping-jack', category: 'cardio' },
  // -- kettlebell-romanian-deadlift
  kettlebell_romanian_deadlift: { name: 'Kettlebell Romanian Deadlift', slug: 'kettlebell-romanian-deadlift', category: 'legs' },
  // -- kettlebell-swing
  kettlebell_swing: { name: 'Kettlebell Swing', slug: 'kettlebell-swing', category: 'full_body' },
  // -- knee-push-up
  knee_push_up: { name: 'Knee Push Up', slug: 'knee-push-up', category: 'chest' },
  // -- kneeling-hip-flexor-stretch
  kneeling_hip_flexor_stretch: { name: 'Kneeling Hip Flexor Stretch', slug: 'kneeling-hip-flexor-stretch', category: 'stretching' },
  // -- l-sit-hold
  l_sit_hold: { name: 'L Sit Hold', slug: 'l-sit-hold', category: 'core' },
  // -- l-sit-pull-up
  l_sit_pull_up: { name: 'L Sit Pull Up', slug: 'l-sit-pull-up', category: 'back' },
  // -- landmine-press
  landmine_press: { name: 'Landmine Press', slug: 'landmine-press', category: 'shoulders' },
  // -- landmine-romanian-deadlift
  landmine_romanian_deadlift: { name: 'Landmine Romanian Deadlift', slug: 'landmine-romanian-deadlift', category: 'legs' },
  // -- landmine-squat
  landmine_squat: { name: 'Landmine Squat', slug: 'landmine-squat', category: 'legs' },
  // -- lat-pulldown
  lat_pulldown: { name: 'Lat Pulldown', slug: 'lat-pulldown', category: 'back' },
  // -- lateral-lunge
  lateral_lunge: { name: 'Lateral Lunge', slug: 'lateral-lunge', category: 'legs' },
  // -- lateral-raise
  lateral_raise: { name: 'Lateral Raise', slug: 'lateral-raise', category: 'shoulders' },
  // -- lateral-shuffle
  lateral_shuffle: { name: 'Lateral Shuffle', slug: 'lateral-shuffle', category: 'cardio' },
  // -- leg-curl
  leg_curl: { name: 'Leg Curl', slug: 'leg-curl', category: 'legs' },
  // -- leg-extension
  leg_extension: { name: 'Leg Extension', slug: 'leg-extension', category: 'legs' },
  // -- leg-press
  leg_press: { name: 'Leg Press', slug: 'leg-press', category: 'legs' },
  // -- leg-press-calf-raise
  leg_press_calf_raise: { name: 'Leg Press Calf Raise', slug: 'leg-press-calf-raise', category: 'legs' },
  // -- leg-swings-stretch
  leg_swings_stretch: { name: 'Leg Swings Stretch', slug: 'leg-swings-stretch', category: 'stretching' },
  // -- lying-hamstring-walkout
  lying_hamstring_walkout: { name: 'Lying Hamstring Walkout', slug: 'lying-hamstring-walkout', category: 'legs' },
  // -- lying-leg-curl
  lying_leg_curl: { name: 'Lying Leg Curl', slug: 'lying-leg-curl', category: 'legs' },
  // -- lying-leg-raise
  lying_leg_raise: { name: 'Lying Leg Raise', slug: 'lying-leg-raise', category: 'core' },
  // -- machine-chest-press
  machine_chest_press: { name: 'Machine Chest Press', slug: 'machine-chest-press', category: 'chest' },
  // -- machine-glute-kickback
  machine_glute_kickback: { name: 'Machine Glute Kickback', slug: 'machine-glute-kickback', category: 'legs' },
  // -- machine-lateral-raise
  machine_lateral_raise: { name: 'Machine Lateral Raise', slug: 'machine-lateral-raise', category: 'shoulders' },
  // -- machine-row
  machine_row: { name: 'Machine Row', slug: 'machine-row', category: 'back' },
  // -- machine-shoulder-press
  machine_shoulder_press: { name: 'Machine Shoulder Press', slug: 'machine-shoulder-press', category: 'shoulders' },
  // -- meadows-row
  meadows_row: { name: 'Meadows Row', slug: 'meadows-row', category: 'back' },
  // -- mountain-climber
  mountain_climber: { name: 'Mountain Climber', slug: 'mountain-climber', category: 'core' },
  // -- negative-pull-up
  negative_pull_up: { name: 'Negative Pull Up', slug: 'negative-pull-up', category: 'back' },
  // -- neutral-grip-pull-up
  neutral_grip_pull_up: { name: 'Neutral Grip Pull Up', slug: 'neutral-grip-pull-up', category: 'back' },
  // -- nordic-hamstring-curl
  nordic_hamstring_curl: { name: 'Nordic Hamstring Curl', slug: 'nordic-hamstring-curl', category: 'legs' },
  // -- one-arm-dumbbell-row
  one_arm_dumbbell_row: { name: 'One Arm Dumbbell Row', slug: 'one-arm-dumbbell-row', category: 'back' },
  // -- overhead-press
  overhead_press: { name: 'Overhead Press', slug: 'overhead-press', category: 'shoulders' },
  // -- overhead-tricep-extension
  overhead_tricep_extension: { name: 'Overhead Tricep Extension', slug: 'overhead-tricep-extension', category: 'arms' },
  // -- pallof-press
  pallof_press: { name: 'Pallof Press', slug: 'pallof-press', category: 'core' },
  // -- pec-deck
  pec_deck: { name: 'Pec Deck', slug: 'pec-deck', category: 'chest' },
  // -- pendlay-row
  pendlay_row: { name: 'Pendlay Row', slug: 'pendlay-row', category: 'back' },
  // -- pike-push-up
  pike_push_up: { name: 'Pike Push Up', slug: 'pike-push-up', category: 'shoulders' },
  // -- pistol-squat
  pistol_squat: { name: 'Pistol Squat', slug: 'pistol-squat', category: 'legs' },
  // -- plank
  plank: { name: 'Plank', slug: 'plank', category: 'core' },
  // -- plank-jack
  plank_jack: { name: 'Plank Jack', slug: 'plank-jack', category: 'core' },
  // -- plank-shoulder-tap
  plank_shoulder_tap: { name: 'Plank Shoulder Tap', slug: 'plank-shoulder-tap', category: 'core' },
  // -- plate-front-raise
  plate_front_raise: { name: 'Plate Front Raise', slug: 'plate-front-raise', category: 'shoulders' },
  // -- preacher-curl
  preacher_curl: { name: 'Preacher Curl', slug: 'preacher-curl', category: 'arms' },
  // -- prone-t-raise
  prone_t_raise: { name: 'Prone T Raise', slug: 'prone-t-raise', category: 'shoulders' },
  // -- prone-y-raise
  prone_y_raise: { name: 'Prone Y Raise', slug: 'prone-y-raise', category: 'shoulders' },
  // -- pull-up
  pull_up: { name: 'Pull Up', slug: 'pull-up', category: 'back' },
  // -- push-press
  push_press: { name: 'Push Press', slug: 'push-press', category: 'shoulders' },
  // -- push-up
  push_up: { name: 'Push Up', slug: 'push-up', category: 'chest' },
  // -- push-up-shoulder-tap
  push_up_shoulder_tap: { name: 'Push Up Shoulder Tap', slug: 'push-up-shoulder-tap', category: 'chest' },
  // -- rack-pull
  rack_pull: { name: 'Rack Pull', slug: 'rack-pull', category: 'back' },
  // -- rear-delt-fly
  rear_delt_fly: { name: 'Rear Delt Fly', slug: 'rear-delt-fly', category: 'shoulders' },
  // -- reverse-crunch
  reverse_crunch: { name: 'Reverse Crunch', slug: 'reverse-crunch', category: 'core' },
  // -- reverse-curl
  reverse_curl: { name: 'Reverse Curl', slug: 'reverse-curl', category: 'arms' },
  // -- reverse-hyperextension
  reverse_hyperextension: { name: 'Reverse Hyperextension', slug: 'reverse-hyperextension', category: 'back' },
  // -- reverse-lunge
  reverse_lunge: { name: 'Reverse Lunge', slug: 'reverse-lunge', category: 'legs' },
  // -- reverse-pec-deck
  reverse_pec_deck: { name: 'Reverse Pec Deck', slug: 'reverse-pec-deck', category: 'shoulders' },
  // -- reverse-snow-angel
  reverse_snow_angel: { name: 'Reverse Snow Angel', slug: 'reverse-snow-angel', category: 'back' },
  // -- romanian-deadlift
  romanian_deadlift: { name: 'Romanian Deadlift', slug: 'romanian-deadlift', category: 'legs' },
  // -- rope-hammer-curl
  rope_hammer_curl: { name: 'Rope Hammer Curl', slug: 'rope-hammer-curl', category: 'arms' },
  // -- rope-tricep-pushdown
  rope_tricep_pushdown: { name: 'Rope Tricep Pushdown', slug: 'rope-tricep-pushdown', category: 'arms' },
  // -- rowing
  rowing: { name: 'Rowing', slug: 'rowing', category: 'cardio' },
  // -- running
  running: { name: 'Running', slug: 'running', category: 'cardio' },
  // -- russian-twist
  russian_twist: { name: 'Russian Twist', slug: 'russian-twist', category: 'core' },
  // -- scapular-pull-up
  scapular_pull_up: { name: 'Scapular Pull Up', slug: 'scapular-pull-up', category: 'back' },
  // -- scapular-push-up
  scapular_push_up: { name: 'Scapular Push Up', slug: 'scapular-push-up', category: 'chest' },
  // -- seal-jack
  seal_jack: { name: 'Seal Jack', slug: 'seal-jack', category: 'cardio' },
  // -- seated-calf-raise
  seated_calf_raise: { name: 'Seated Calf Raise', slug: 'seated-calf-raise', category: 'legs' },
  // -- seated-dumbbell-press
  seated_dumbbell_press: { name: 'Seated Dumbbell Press', slug: 'seated-dumbbell-press', category: 'shoulders' },
  // -- seated-forward-fold-stretch
  seated_forward_fold_stretch: { name: 'Seated Forward Fold Stretch', slug: 'seated-forward-fold-stretch', category: 'stretching' },
  // -- seated-knee-tuck
  seated_knee_tuck: { name: 'Seated Knee Tuck', slug: 'seated-knee-tuck', category: 'core' },
  // -- seated-leg-curl
  seated_leg_curl: { name: 'Seated Leg Curl', slug: 'seated-leg-curl', category: 'legs' },
  // -- seated-row
  seated_row: { name: 'Seated Row', slug: 'seated-row', category: 'back' },
  // -- shrimp-squat
  shrimp_squat: { name: 'Shrimp Squat', slug: 'shrimp-squat', category: 'legs' },
  // -- shrug
  shrug: { name: 'Shrug', slug: 'shrug', category: 'shoulders' },
  // -- side-lying-hip-abduction
  side_lying_hip_abduction: { name: 'Side Lying Hip Abduction', slug: 'side-lying-hip-abduction', category: 'legs' },
  // -- side-lying-leg-raise
  side_lying_leg_raise: { name: 'Side Lying Leg Raise', slug: 'side-lying-leg-raise', category: 'legs' },
  // -- side-plank
  side_plank: { name: 'Side Plank', slug: 'side-plank', category: 'core' },
  // -- side-plank-hip-dip
  side_plank_hip_dip: { name: 'Side Plank Hip Dip', slug: 'side-plank-hip-dip', category: 'core' },
  // -- single-arm-cable-row
  single_arm_cable_row: { name: 'Single Arm Cable Row', slug: 'single-arm-cable-row', category: 'back' },
  // -- single-arm-dumbbell-tricep-extension
  single_arm_dumbbell_tricep_extension: { name: 'Single Arm Dumbbell Tricep Extension', slug: 'single-arm-dumbbell-tricep-extension', category: 'arms' },
  // -- single-dumbbell-skullcrusher
  single_dumbbell_skullcrusher: { name: 'Single Dumbbell Skullcrusher', slug: 'single-dumbbell-skullcrusher', category: 'arms' },
  // -- single-leg-box-squat
  single_leg_box_squat: { name: 'Single Leg Box Squat', slug: 'single-leg-box-squat', category: 'legs' },
  // -- single-leg-calf-raise
  single_leg_calf_raise: { name: 'Single Leg Calf Raise', slug: 'single-leg-calf-raise', category: 'legs' },
  // -- single-leg-glute-bridge
  single_leg_glute_bridge: { name: 'Single Leg Glute Bridge', slug: 'single-leg-glute-bridge', category: 'legs' },
  // -- single-leg-romanian-deadlift
  single_leg_romanian_deadlift: { name: 'Single Leg Romanian Deadlift', slug: 'single-leg-romanian-deadlift', category: 'legs' },
  // -- sissy-squat
  sissy_squat: { name: 'Sissy Squat', slug: 'sissy-squat', category: 'legs' },
  // -- skater-hop
  skater_hop: { name: 'Skater Hop', slug: 'skater-hop', category: 'cardio' },
  // -- skater-squat
  skater_squat: { name: 'Skater Squat', slug: 'skater-squat', category: 'legs' },
  // -- skierg
  skierg: { name: 'Skierg', slug: 'skierg', category: 'cardio' },
  // -- skull-crusher
  skull_crusher: { name: 'Skull Crusher', slug: 'skull-crusher', category: 'arms' },
  // -- smith-machine-bench-press
  smith_machine_bench_press: { name: 'Smith Machine Bench Press', slug: 'smith-machine-bench-press', category: 'chest' },
  // -- smith-machine-bulgarian-split-squat
  smith_machine_bulgarian_split_squat: { name: 'Smith Machine Bulgarian Split Squat', slug: 'smith-machine-bulgarian-split-squat', category: 'legs' },
  // -- smith-machine-hip-thrust
  smith_machine_hip_thrust: { name: 'Smith Machine Hip Thrust', slug: 'smith-machine-hip-thrust', category: 'legs' },
  // -- smith-machine-reverse-lunge
  smith_machine_reverse_lunge: { name: 'Smith Machine Reverse Lunge', slug: 'smith-machine-reverse-lunge', category: 'legs' },
  // -- smith-machine-romanian-deadlift
  smith_machine_romanian_deadlift: { name: 'Smith Machine Romanian Deadlift', slug: 'smith-machine-romanian-deadlift', category: 'legs' },
  // -- smith-machine-split-squat
  smith_machine_split_squat: { name: 'Smith Machine Split Squat', slug: 'smith-machine-split-squat', category: 'legs' },
  // -- smith-machine-squat
  smith_machine_squat: { name: 'Smith Machine Squat', slug: 'smith-machine-squat', category: 'legs' },
  // -- spider-curl
  spider_curl: { name: 'Spider Curl', slug: 'spider-curl', category: 'arms' },
  // -- split-squat
  split_squat: { name: 'Split Squat', slug: 'split-squat', category: 'legs' },
  // -- sprawl
  sprawl: { name: 'Sprawl', slug: 'sprawl', category: 'full_body' },
  // -- squat (barbell-back-squat slug uses key "squat" to match our EXERCISES)
  squat: { name: 'Squat', slug: 'squat', category: 'legs' },
  // -- squat-thrust
  squat_thrust: { name: 'Squat Thrust', slug: 'squat-thrust', category: 'full_body' },
  // -- stability-ball-hamstring-curl
  stability_ball_hamstring_curl: { name: 'Stability Ball Hamstring Curl', slug: 'stability-ball-hamstring-curl', category: 'legs' },
  // -- stair-climber
  stair_climber: { name: 'Stair Climber', slug: 'stair-climber', category: 'cardio' },
  // -- standing-calf-raise
  standing_calf_raise: { name: 'Standing Calf Raise', slug: 'standing-calf-raise', category: 'legs' },
  // -- standing-dumbbell-press
  standing_dumbbell_press: { name: 'Standing Dumbbell Press', slug: 'standing-dumbbell-press', category: 'shoulders' },
  // -- standing-quad-stretch
  standing_quad_stretch: { name: 'Standing Quad Stretch', slug: 'standing-quad-stretch', category: 'stretching' },
  // -- step-down
  step_down: { name: 'Step Down', slug: 'step-down', category: 'legs' },
  // -- step-up
  step_up: { name: 'Step Up', slug: 'step-up', category: 'legs' },
  // -- straight-arm-pulldown
  straight_arm_pulldown: { name: 'Straight Arm Pulldown', slug: 'straight-arm-pulldown', category: 'back' },
  // -- sumo-deadlift
  sumo_deadlift: { name: 'Sumo Deadlift', slug: 'sumo-deadlift', category: 'legs' },
  // -- superman
  superman: { name: 'Superman', slug: 'superman', category: 'back' },
  // -- superman-hold
  superman_hold: { name: 'Superman Hold', slug: 'superman-hold', category: 'back' },
  // -- swimming
  swimming: { name: 'Swimming', slug: 'swimming', category: 'cardio' },
  // -- t-bar-row
  t_bar_row: { name: 'T Bar Row', slug: 't-bar-row', category: 'back' },
  // -- toe-touch
  toe_touch: { name: 'Toe Touch', slug: 'toe-touch', category: 'stretching' },
  // -- torso-twist-stretch
  torso_twist_stretch: { name: 'Torso Twist Stretch', slug: 'torso-twist-stretch', category: 'stretching' },
  // -- towel-hamstring-curl
  towel_hamstring_curl: { name: 'Towel Hamstring Curl', slug: 'towel-hamstring-curl', category: 'legs' },
  // -- towel-pull-up
  towel_pull_up: { name: 'Towel Pull Up', slug: 'towel-pull-up', category: 'back' },
  // -- towel-row
  towel_row: { name: 'Towel Row', slug: 'towel-row', category: 'back' },
  // -- trap-bar-deadlift
  trap_bar_deadlift: { name: 'Trap Bar Deadlift', slug: 'trap-bar-deadlift', category: 'legs' },
  // -- treadmill-incline-walk
  treadmill_incline_walk: { name: 'Treadmill Incline Walk', slug: 'treadmill-incline-walk', category: 'cardio' },
  // -- tricep-kickback
  tricep_kickback: { name: 'Tricep Kickback', slug: 'tricep-kickback', category: 'arms' },
  // -- tricep-pushdown
  tricep_pushdown: { name: 'Tricep Pushdown', slug: 'tricep-pushdown', category: 'arms' },
  // -- typewriter-push-up
  typewriter_push_up: { name: 'Typewriter Push Up', slug: 'typewriter-push-up', category: 'chest' },
  // -- upright-row
  upright_row: { name: 'Upright Row', slug: 'upright-row', category: 'shoulders' },
  // -- v-up
  v_up: { name: 'V Up', slug: 'v-up', category: 'core' },
  // -- walking
  walking: { name: 'Walking', slug: 'walking', category: 'cardio' },
  // -- walking-lunge
  walking_lunge: { name: 'Walking Lunge', slug: 'walking-lunge', category: 'legs' },
  // -- wall-calf-stretch
  wall_calf_stretch: { name: 'Wall Calf Stretch', slug: 'wall-calf-stretch', category: 'stretching' },
  // -- wall-handstand-push-up
  wall_handstand_push_up: { name: 'Wall Handstand Push Up', slug: 'wall-handstand-push-up', category: 'shoulders' },
  // -- wall-push-up
  wall_push_up: { name: 'Wall Push Up', slug: 'wall-push-up', category: 'chest' },
  // -- wall-sit
  wall_sit: { name: 'Wall Sit', slug: 'wall-sit', category: 'legs' },
  // -- wall-walk
  wall_walk: { name: 'Wall Walk', slug: 'wall-walk', category: 'full_body' },
  // -- weighted-chin-up
  weighted_chin_up: { name: 'Weighted Chin Up', slug: 'weighted-chin-up', category: 'back' },
  // -- weighted-crunch
  weighted_crunch: { name: 'Weighted Crunch', slug: 'weighted-crunch', category: 'core' },
  // -- weighted-dip
  weighted_dip: { name: 'Weighted Dip', slug: 'weighted-dip', category: 'chest' },
  // -- weighted-pull-up
  weighted_pull_up: { name: 'Weighted Pull Up', slug: 'weighted-pull-up', category: 'back' },
  // -- weighted-push-up
  weighted_push_up: { name: 'Weighted Push Up', slug: 'weighted-push-up', category: 'chest' },
  // -- weighted-russian-twist
  weighted_russian_twist: { name: 'Weighted Russian Twist', slug: 'weighted-russian-twist', category: 'core' },
  // -- wide-grip-lat-pulldown
  wide_grip_lat_pulldown: { name: 'Wide Grip Lat Pulldown', slug: 'wide-grip-lat-pulldown', category: 'back' },
  // -- wide-push-up
  wide_push_up: { name: 'Wide Push Up', slug: 'wide-push-up', category: 'chest' },
  // -- worlds-greatest-stretch
  worlds_greatest_stretch: { name: 'Worlds Greatest Stretch', slug: 'worlds-greatest-stretch', category: 'stretching' },
  // -- wrist-curl
  wrist_curl: { name: 'Wrist Curl', slug: 'wrist-curl', category: 'arms' },
  // -- wrist-extension
  wrist_extension: { name: 'Wrist Extension', slug: 'wrist-extension', category: 'arms' },
};

// Also add the "barbell-back-squat" slug under its own key so it is reachable
// when browsing. The "squat" key above maps to the plain "squat" slug from the
// library. KEY_TO_SLUG maps squat -> barbell-back-squat for our internal use.
GUIDE_EXERCISES.barbell_back_squat = { name: 'Barbell Back Squat', slug: 'barbell-back-squat', category: 'legs' };

// Slug that exists in library but has no natural snake_case alias above:
// "bent-over-row" -> mapped via KEY_TO_SLUG only; add as guide entry too
GUIDE_EXERCISES.bent_over_row = { name: 'Bent Over Row', slug: 'bent-over-row', category: 'back' };
// "cable-row" -> only in KEY_TO_SLUG
GUIDE_EXERCISES.cable_row = { name: 'Cable Row', slug: 'cable-row', category: 'back' };
// "dumbbell-row" -> only in KEY_TO_SLUG
GUIDE_EXERCISES.dumbbell_row = { name: 'Dumbbell Row', slug: 'dumbbell-row', category: 'back' };
// "cable-tricep-pushdown" -> KEY_TO_SLUG alias
GUIDE_EXERCISES.cable_tricep_pushdown = { name: 'Cable Tricep Pushdown', slug: 'cable-tricep-pushdown', category: 'arms' };
// "machine-tricep-extension" -> KEY_TO_SLUG alias
GUIDE_EXERCISES.machine_tricep_extension = { name: 'Machine Tricep Extension', slug: 'machine-tricep-extension', category: 'arms' };
// "dumbbell-shoulder-press" -> KEY_TO_SLUG alias
GUIDE_EXERCISES.dumbbell_shoulder_press = { name: 'Dumbbell Shoulder Press', slug: 'dumbbell-shoulder-press', category: 'shoulders' };
// "deficit-push-up" -> KEY_TO_SLUG
GUIDE_EXERCISES.deficit_push_up = { name: 'Deficit Push Up', slug: 'deficit-push-up', category: 'chest' };
// "box-jump" (not in the 302 list but was in KEY_TO_SLUG)
// Actually it is not in the 302 list. Keep the KEY_TO_SLUG entry but no guide entry.
// "clean-and-press" (not in the 302 list but was in KEY_TO_SLUG)
// Same handling.
// "lunge" slug exists as "forward-lunge" in the 302. The KEY_TO_SLUG "lunge" -> "lunge" may
// not have frames. We keep the KEY_TO_SLUG entry as-is.
// "sit-up" -> not in 302 list (they have "decline-sit-up"). KEY_TO_SLUG kept.
// "leg-raise" -> not in 302 list (they have "lying-leg-raise" and "hanging-leg-raise"). KEY_TO_SLUG kept.
// "tricep-extension" -> not in 302 (they have "overhead-tricep-extension"). KEY_TO_SLUG kept.

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Get the CDN URL for an exercise frame SVG.
 * @param {string} slug - workout-guide slug
 * @param {1|2|3} frame - frame number (1-3)
 * @returns {string} CDN URL
 */
export function getFrameUrl(slug, frame) {
  return `${CDN_BASE}/${slug}/frame-${frame}.svg`;
}

/**
 * Build frames array from a slug.
 * @param {string} slug
 * @returns {string[]} array of 3 frame URLs
 */
function buildFrames(slug) {
  return [getFrameUrl(slug, 1), getFrameUrl(slug, 2), getFrameUrl(slug, 3)];
}

/**
 * Get frame URLs for an exercise by our internal key.
 * Works with both legacy KEY_TO_SLUG entries and new GUIDE_EXERCISES entries.
 * @param {string} exerciseKey - our snake_case key
 * @returns {{ slug: string, frames: string[] } | null}
 */
export function getExerciseFrames(exerciseKey) {
  // Check KEY_TO_SLUG first (legacy mappings, e.g. squat -> barbell-back-squat)
  const legacySlug = KEY_TO_SLUG[exerciseKey];
  if (legacySlug) {
    return { slug: legacySlug, frames: buildFrames(legacySlug) };
  }
  // Check GUIDE_EXERCISES
  const guide = GUIDE_EXERCISES[exerciseKey];
  if (guide) {
    return { slug: guide.slug, frames: buildFrames(guide.slug) };
  }
  return null;
}

/**
 * Check if an exercise has visual guide frames available.
 * @param {string} exerciseKey
 * @returns {boolean}
 */
export function hasExerciseGuide(exerciseKey) {
  return exerciseKey in KEY_TO_SLUG || exerciseKey in GUIDE_EXERCISES;
}

/**
 * Get the slug for an exercise key.
 * @param {string} exerciseKey
 * @returns {string|null}
 */
export function getSlug(exerciseKey) {
  if (KEY_TO_SLUG[exerciseKey]) return KEY_TO_SLUG[exerciseKey];
  if (GUIDE_EXERCISES[exerciseKey]) return GUIDE_EXERCISES[exerciseKey].slug;
  return null;
}

/**
 * Get all mapped exercise keys (union of KEY_TO_SLUG and GUIDE_EXERCISES).
 * @returns {string[]}
 */
export function getMappedKeys() {
  const keys = new Set([
    ...Object.keys(KEY_TO_SLUG),
    ...Object.keys(GUIDE_EXERCISES),
  ]);
  return [...keys];
}

/**
 * Get a single guide exercise entry with frames.
 * @param {string} key
 * @returns {{ name: string, slug: string, category: string, frames: string[] } | null}
 */
export function getGuideExercise(key) {
  const guide = GUIDE_EXERCISES[key];
  if (guide) {
    return { ...guide, frames: buildFrames(guide.slug) };
  }
  // Fallback: if key is in KEY_TO_SLUG but not in GUIDE_EXERCISES
  const slug = KEY_TO_SLUG[key];
  if (slug) {
    // Derive name from key
    const name = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    return { name, slug, category: 'full_body', frames: buildFrames(slug) };
  }
  return null;
}

/**
 * Get all guide exercises as an array of { key, name, slug, category, frames }.
 * @returns {Array<{ key: string, name: string, slug: string, category: string, frames: string[] }>}
 */
export function getAllGuideExercises() {
  const all = new Map();
  // GUIDE_EXERCISES first (canonical data)
  for (const [key, entry] of Object.entries(GUIDE_EXERCISES)) {
    all.set(key, { key, ...entry, frames: buildFrames(entry.slug) });
  }
  // KEY_TO_SLUG entries that are not yet in the map
  for (const [key, slug] of Object.entries(KEY_TO_SLUG)) {
    if (!all.has(key)) {
      const name = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      all.set(key, { key, name, slug, category: 'full_body', frames: buildFrames(slug) });
    }
  }
  return [...all.values()];
}
