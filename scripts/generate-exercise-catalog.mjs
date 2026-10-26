// Generator for WorkoutVision's expanded 1,000+ movement variations catalog
// Normalized compact format for minimal asset footprint and fast lazy loading
import fs from 'node:fs';
import path from 'node:path';

const outPath = path.resolve('src/lib/exercises/exercises.json');

// Base templates with equipment & modifier variations
const BASE_MOVEMENTS = [
  // --- QUAD DOMINANT / SQUATS & PRESSES (Archetype: squat) ---
  {
    baseId: 'squat',
    nameEn: 'Squat',
    nameFr: 'Squat',
    archetype: 'squat',
    countingKey: 'squat',
    primary: ['quadriceps', 'glutes'],
    secondary: ['adductors', 'core', 'erector_spinae'],
    setupEn: 'Place feet shoulder-width apart with toes slightly turned out. Brace core and align pelvis.',
    setupFr: 'Placez vos pieds à largeur d’épaules, pointes légèrement ouvertes. Gaine le tronc et aligne le bassin.',
    cuesEn: ['Drive knees forward in line with toes', 'Descend under control until thighs reach parallel or below', 'Push through mid-foot with hips and chest rising synchronously'],
    cuesFr: ['Genoux alignés dans l’axe des orteils', 'Descente contrôlée jusqu’au parallèle ou plus bas', 'Poussez sur le milieu du pied en montant hanches et buste ensemble'],
    hypertrophyEn: ['Emphasize the deep stretch at the bottom to maximize quad tension', 'Maintain smooth continuous motion without bouncing off the ligaments'],
    hypertrophyFr: ['Maximisez l’étirement profond en bas pour stimuler les quadriceps', 'Contrôlez l’inversion sans rebond élastique sur les articulations'],
    equipmentVariants: [
      { eq: 'barbell', nameEn: 'Barbell Back Squat', nameFr: 'Squat arrière à la barre' },
      { eq: 'barbell', nameEn: 'Front Squat', nameFr: 'Squat avant à la barre' },
      { eq: 'barbell', nameEn: 'Safety Bar Squat', nameFr: 'Squat barre de sécurité' },
      { eq: 'barbell', nameEn: 'Zercher Squat', nameFr: 'Squat Zercher' },
      { eq: 'barbell', nameEn: 'Box Squat', nameFr: 'Squat sur boîte' },
      { eq: 'barbell', nameEn: 'Heel-Elevated Squat', nameFr: 'Squat talons surélevés' },
      { eq: 'dumbbell', nameEn: 'Goblet Squat', nameFr: 'Squat gobelet haltère' },
      { eq: 'dumbbell', nameEn: 'Dumbbell Squat', nameFr: 'Squat aux haltères' },
      { eq: 'kettlebell', nameEn: 'Kettlebell Front Squat', nameFr: 'Squat kettlebell au rack' },
      { eq: 'smith_machine', nameEn: 'Smith Machine Squat', nameFr: 'Squat à la machine Smith' },
      { eq: 'cable', nameEn: 'Cable Squat', nameFr: 'Squat à la poulie' },
      { eq: 'machine', nameEn: 'Belt Squat', nameFr: 'Squat à la ceinture (Belt Squat)' },
      { eq: 'bodyweight', nameEn: 'Air Squat', nameFr: 'Squat au poids de corps' },
      { eq: 'bodyweight', nameEn: 'Sissy Squat', nameFr: 'Sissy Squat' },
    ]
  },
  {
    baseId: 'hack_squat',
    nameEn: 'Hack Squat',
    nameFr: 'Hack Squat',
    archetype: 'squat',
    countingKey: 'hack_squat',
    primary: ['quadriceps'],
    secondary: ['glutes', 'adductors'],
    setupEn: 'Rest back firmly against machine backrest, position feet mid-platform shoulder-width apart.',
    setupFr: 'Plaquez le dos contre le dossier, pieds au milieu du plateau à largeur d’épaules.',
    cuesEn: ['Keep lower back glued to pad', 'Bend knees smoothly allowing deep flexion without heels lifting', 'Drive sled up maintaining quad tension without locking knees out violently'],
    cuesFr: ['Bassin plaqué au dossier', 'Fléchissez les genoux profondément sans décoller les talons', 'Poussez le traîneau sans verrouillage brutal des genoux'],
    hypertrophyEn: ['Pause 1 second in the deepest stretch for maximum motor unit recruitment', 'Control a 3-second eccentric to eliminate momentum'],
    hypertrophyFr: ['Marquez un temps d’arrêt d’1 seconde au point d’étirement maximal', 'Adoptez une phase excentrique contrôlée de 3 secondes sans à-coups'],
    equipmentVariants: [
      { eq: 'machine', nameEn: 'Machine Hack Squat', nameFr: 'Hack Squat machine' },
      { eq: 'machine', nameEn: 'Pendulum Squat', nameFr: 'Squat pendulaire (Pendulum Squat)' },
      { eq: 'barbell', nameEn: 'Barbell Hack Squat', nameFr: 'Hack Squat à la barre' },
      { eq: 'smith_machine', nameEn: 'Smith Machine Hack Squat', nameFr: 'Hack Squat guidé' },
      { eq: 'machine', nameEn: 'Reverse Hack Squat', nameFr: 'Hack Squat inversé' },
    ]
  },
  {
    baseId: 'leg_press',
    nameEn: 'Leg Press',
    nameFr: 'Presse à cuisses',
    archetype: 'squat',
    countingKey: 'leg_press',
    primary: ['quadriceps', 'glutes'],
    secondary: ['hamstrings', 'adductors'],
    setupEn: 'Sit securely with lumbar supported, feet placed shoulder-width on carriage platform.',
    setupFr: 'Asseyez-vous le bas du dos bien calé au siège, pieds à largeur d’épaules sur le plateau.',
    cuesEn: ['Do not let pelvis tuck or lift from seat at bottom', 'Lower carriage smoothly to 90 degrees or deeper knee flexion', 'Push platform back without hyperextending knees'],
    cuesFr: ['Ne laissez jamais le bas du dos s’arrondir ou se décoller', 'Descendez le plateau avec fluidité jusqu’à une flexion profonde', 'Repoussez sans claquer les genoux'],
    hypertrophyEn: ['Eliminate momentum at turnaround to keep tension on the vastus muscles', 'Avoid locking knees at lockout to keep muscular time-under-tension continuous'],
    hypertrophyFr: ['Supprimez tout à-coup au demi-tour pour garder la charge sur les quadriceps', 'Gardez une légère flexion au sommet pour maintenir la tension mécanique'],
    equipmentVariants: [
      { eq: 'machine', nameEn: '45-Degree Leg Press', nameFr: 'Presse à cuisses 45°' },
      { eq: 'machine', nameEn: 'Horizontal Leg Press', nameFr: 'Presse à cuisses horizontale' },
      { eq: 'machine', nameEn: 'Vertical Leg Press', nameFr: 'Presse à cuisses verticale' },
      { eq: 'machine', nameEn: 'Single-Leg 45 Leg Press', nameFr: 'Presse à cuisses unilatérale' },
      { eq: 'machine', nameEn: 'High-Foot Leg Press', nameFr: 'Presse pieds hauts' },
      { eq: 'machine', nameEn: 'Narrow-Stance Leg Press', nameFr: 'Presse pieds serrés' },
    ]
  },
  {
    baseId: 'lunge',
    nameEn: 'Lunge',
    nameFr: 'Fente',
    archetype: 'squat',
    countingKey: 'lunge',
    primary: ['quadriceps', 'glutes'],
    secondary: ['hamstrings', 'calves', 'core'],
    setupEn: 'Step one foot forward and balance on rear ball of foot, torso tall and core braced.',
    setupFr: 'Avancez une jambe, en appui sur la pointe du pied arrière, buste droit et gainé.',
    cuesEn: ['Lower back knee toward floor under control', 'Front knee tracks over front toes', 'Push through front heel to return'],
    cuesFr: ['Descendez le genou arrière vers le sol avec contrôle', 'Le genou avant suit l’axe du pied', 'Poussez sur le talon avant pour remonter'],
    hypertrophyEn: ['Keep torso slightly inclined forward to maximize glute stretch under load', 'Avoid bouncing rear knee off the floor'],
    hypertrophyFr: ['Buste légèrement penché pour accentuer l’étirement du grand fessier', 'Ne faites pas rebondir le genou arrière au sol'],
    equipmentVariants: [
      { eq: 'dumbbell', nameEn: 'Dumbbell Walking Lunge', nameFr: 'Fentes marchées aux haltères' },
      { eq: 'dumbbell', nameEn: 'Dumbbell Reverse Lunge', nameFr: 'Fentes arrière aux haltères' },
      { eq: 'barbell', nameEn: 'Barbell Walking Lunge', nameFr: 'Fentes marchées à la barre' },
      { eq: 'barbell', nameEn: 'Barbell Reverse Lunge', nameFr: 'Fentes arrière à la barre' },
      { eq: 'dumbbell', nameEn: 'Bulgarian Split Squat', nameFr: 'Fente bulgare aux haltères' },
      { eq: 'smith_machine', nameEn: 'Smith Machine Split Squat', nameFr: 'Fente bulgare guidée' },
      { eq: 'bodyweight', nameEn: 'Side Lunge', nameFr: 'Fente latérale' },
      { eq: 'dumbbell', nameEn: 'Step-Up', nameFr: 'Montée sur banc aux haltères' },
    ]
  },

  // --- POSTERIOR CHAIN / HINGES & ISOLATIONS (Archetype: hinge) ---
  {
    baseId: 'deadlift',
    nameEn: 'Deadlift',
    nameFr: 'Soulevé de terre',
    archetype: 'hinge',
    countingKey: 'deadlift',
    primary: ['erector_spinae', 'glutes', 'hamstrings'],
    secondary: ['latissimus_dorsi', 'trapezius', 'forearms'],
    setupEn: 'Bar over mid-foot, hips hinged back, chest tall with neutral spine and lats engaged.',
    setupFr: 'Barre au-dessus du milieu du pied, hanches reculées, dos neutre et dorsaux engagés.',
    cuesEn: ['Pull slack out of bar before lifting', 'Push floor away through heels and mid-foot', 'Lock hips and knees simultaneously at top'],
    cuesFr: ['Tendez les bras et engagez les dorsaux avant de tirer', 'Repoussez le sol avec les jambes', 'Verrouillez hanches et genoux simultanément'],
    hypertrophyEn: ['Control the descent rather than free-falling the bar', 'Keep lats packed tight to prevent lumbar spinal flexing under load'],
    hypertrophyFr: ['Contrôlez la descente sans relâcher la charge au sol', 'Verrouillez les dorsaux pour préserver la courbure lombaire'],
    equipmentVariants: [
      { eq: 'barbell', nameEn: 'Conventional Deadlift', nameFr: 'Soulevé de terre traditionnel' },
      { eq: 'barbell', nameEn: 'Sumo Deadlift', nameFr: 'Soulevé de terre sumo' },
      { eq: 'barbell', nameEn: 'Deficit Deadlift', nameFr: 'Soulevé de terre en déficit' },
      { eq: 'barbell', nameEn: 'Trap Bar Deadlift', nameFr: 'Soulevé de terre à la barre hexagonale' },
      { eq: 'barbell', nameEn: 'Rack Pull', nameFr: 'Tirage en rack (Rack Pull)' },
      { eq: 'dumbbell', nameEn: 'Dumbbell Deadlift', nameFr: 'Soulevé de terre aux haltères' },
      { eq: 'kettlebell', nameEn: 'Kettlebell Deadlift', nameFr: 'Soulevé de terre au kettlebell' },
    ]
  },
  {
    baseId: 'romanian_deadlift',
    nameEn: 'Romanian Deadlift (RDL)',
    nameFr: 'Soulevé de terre roumain (RDL)',
    archetype: 'hinge',
    countingKey: 'romanian_deadlift',
    primary: ['hamstrings', 'glutes'],
    secondary: ['erector_spinae', 'core'],
    setupEn: 'Stand upright holding load, soft knee bend unlocked, shoulders pinned back.',
    setupFr: 'Debout avec la charge, genoux déverrouillés, épaules fixées vers l’arrière.',
    cuesEn: ['Hinge hips backward as if touching a wall behind you', 'Keep bar tracing closely down thighs and shins', 'Stop when hips can travel no further back, then squeeze glutes to return'],
    cuesFr: ['Poussez les hanches vers l’arrière comme pour toucher un mur', 'Gardez la charge collée le long des cuisses', 'Arrêtez dès que le bassin ne recule plus, remontez en contractant les fessiers'],
    hypertrophyEn: ['Focus entirely on hamstring stretch in the lengthened position without rounding back', 'Maintain constant soft knee angle without turning the hinge into a squat'],
    hypertrophyFr: ['Concentrez-vous sur l’étirement maximal des ischio-jambiers sans cambrer', 'Gardez un angle de genou fixe pour ne pas transformer le mouvement en squat'],
    equipmentVariants: [
      { eq: 'barbell', nameEn: 'Barbell Romanian Deadlift', nameFr: 'Soulevé de terre roumain à la barre' },
      { eq: 'dumbbell', nameEn: 'Dumbbell Romanian Deadlift', nameFr: 'Soulevé de terre roumain aux haltères' },
      { eq: 'smith_machine', nameEn: 'Smith Machine Romanian Deadlift', nameFr: 'Soulevé roumain à la machine Smith' },
      { eq: 'cable', nameEn: 'Cable Pull-Through', nameFr: 'Pull-through à la poulie' },
      { eq: 'dumbbell', nameEn: 'Single-Leg Romanian Deadlift', nameFr: 'Soulevé roumain unilatéral' },
      { eq: 'barbell', nameEn: 'Stiff-Legged Deadlift', nameFr: 'Soulevé de terre jambes tendues' },
      { eq: 'barbell', nameEn: 'Good Morning', nameFr: 'Good Morning à la barre' },
    ]
  },
  {
    baseId: 'hip_thrust',
    nameEn: 'Hip Thrust',
    nameFr: 'Hip Thrust',
    archetype: 'hinge',
    countingKey: 'hip_thrust',
    primary: ['glutes'],
    secondary: ['hamstrings', 'adductors', 'core'],
    setupEn: 'Upper back against bench at scapulae level, barbell padded over hip crease, feet flat on floor.',
    setupFr: 'Haut du dos calé contre le banc sous les omoplates, barre rembourrée sur le bassin, pieds à plat.',
    cuesEn: ['Tuck chin and gaze forward throughout', 'Drive through heels to extend hips fully horizontally', 'Hold 1 second squeeze at peak contraction without arching lower back'],
    cuesFr: ['Menton rentré, regard vers l’avant', 'Poussez sur les talons pour aligner hanches, genoux et épaules', 'Bloquez 1 seconde en haut sans cambrer le bas du dos'],
    hypertrophyEn: ['Achieve complete terminal hip extension where glute fibers are in maximum shortened tension', 'Avoid excessive hyperextension by pivoting around thoracic spine'],
    hypertrophyFr: ['Atteignez l’extension complète où le grand fessier est en raccourcissement maximal', 'Verrouillez le bassin en rétroversion sans solliciter les lombaires'],
    equipmentVariants: [
      { eq: 'barbell', nameEn: 'Barbell Hip Thrust', nameFr: 'Hip Thrust à la barre' },
      { eq: 'machine', nameEn: 'Machine Hip Thrust', nameFr: 'Hip Thrust à la machine' },
      { eq: 'smith_machine', nameEn: 'Smith Machine Hip Thrust', nameFr: 'Hip Thrust guidé' },
      { eq: 'dumbbell', nameEn: 'Dumbbell Glute Bridge', nameFr: 'Pont fessier avec haltère' },
      { eq: 'bodyweight', nameEn: 'Single-Leg Hip Thrust', nameFr: 'Hip Thrust unilatéral' },
      { eq: 'machine', nameEn: 'Back Extension 45°', nameFr: 'Banc à lombaires 45°' },
    ]
  },
  {
    baseId: 'leg_curl',
    nameEn: 'Leg Curl',
    nameFr: 'Leg Curl (Ischios machine)',
    archetype: 'isolation',
    countingKey: 'leg_curl',
    primary: ['hamstrings'],
    secondary: ['calves'],
    setupEn: 'Align knee joint axis with machine pivot point, pad resting just above Achilles tendon.',
    setupFr: 'Alignez l’axe des genoux avec le pivot de la machine, boudin calé au-dessus des chevilles.',
    cuesEn: ['Secure thigh pad firmly to lock pelvis', 'Curl heels toward glutes smoothly', 'Control the eccentric release through full knee extension'],
    cuesFr: ['Serrez le coussin pour maintenir le bassin', 'Fléchissez les talons vers les fessiers avec fluidité', 'Contrôlez l’ouverture complète des genoux à la descente'],
    hypertrophyEn: ['Emphasize the fully lengthened position as knees straighten under load', 'Do not let hips lift off the bench to cheat through the turn'],
    hypertrophyFr: ['Favorisez l’étirement complet en fin de descente sans relâcher la charge', 'Gardez le bassin plaqué pour isoler strictement les ischio-jambiers'],
    equipmentVariants: [
      { eq: 'machine', nameEn: 'Seated Leg Curl', nameFr: 'Leg Curl assis' },
      { eq: 'machine', nameEn: 'Lying Leg Curl', nameFr: 'Leg Curl couché' },
      { eq: 'machine', nameEn: 'Standing Leg Curl', nameFr: 'Leg Curl debout' },
      { eq: 'bodyweight', nameEn: 'Nordic Hamstring Curl', nameFr: 'Nordic Hamstring Curl' },
      { eq: 'cable', nameEn: 'Cable Leg Curl', nameFr: 'Leg Curl à la poulie' },
    ]
  },

  // --- UPPER BODY / HORIZONTAL & VERTICAL PUSH (Archetype: push) ---
  {
    baseId: 'bench_press',
    nameEn: 'Bench Press',
    nameFr: 'Développé couché',
    archetype: 'push',
    countingKey: 'bench_press',
    primary: ['pectoralis_major'],
    secondary: ['anterior_deltoid', 'triceps'],
    setupEn: 'Lie flat on bench, eyes under bar, retract scapulae, plant feet firmly into floor.',
    setupFr: 'Allongé sur le banc, yeux sous la barre, omoplates serrées et pieds ancrés au sol.',
    cuesEn: ['Lower bar with control to lower-mid sternum', 'Maintain 45 to 70 degree elbow tuck', 'Press bar in slight j-curve back over shoulders to lockout'],
    cuesFr: ['Descendez la barre avec contrôle sur le bas des pectoraux', 'Coudes à 45-70 degrés du buste', 'Poussez la barre vers le haut et légèrement vers les épaules'],
    hypertrophyEn: ['Touch chest gently and pause without bouncing off ribcage', 'Keep shoulder blades retracted throughout whole set to protect rotator cuff'],
    hypertrophyFr: ['Touchez la poitrine délicatement sans rebondir sur la cage thoracique', 'Maintenez les omoplates rétractées pour préserver la coiffe des rotateurs'],
    equipmentVariants: [
      { eq: 'barbell', nameEn: 'Flat Barbell Bench Press', nameFr: 'Développé couché barre' },
      { eq: 'barbell', nameEn: 'Incline Barbell Bench Press', nameFr: 'Développé incliné barre' },
      { eq: 'barbell', nameEn: 'Decline Barbell Bench Press', nameFr: 'Développé décliné barre' },
      { eq: 'barbell', nameEn: 'Close-Grip Bench Press', nameFr: 'Développé couché prise serrée' },
      { eq: 'barbell', nameEn: 'Wide-Grip Bench Press', nameFr: 'Développé couché prise large' },
      { eq: 'barbell', nameEn: 'Cambered Bar Bench Press', nameFr: 'Développé barre cambrée' },
      { eq: 'dumbbell', nameEn: 'Flat Dumbbell Bench Press', nameFr: 'Développé couché aux haltères' },
      { eq: 'dumbbell', nameEn: 'Incline Dumbbell Press', nameFr: 'Développé incliné aux haltères' },
      { eq: 'dumbbell', nameEn: 'Decline Dumbbell Press', nameFr: 'Développé décliné aux haltères' },
      { eq: 'dumbbell', nameEn: 'Neutral Grip Dumbbell Press', nameFr: 'Développé haltères prise neutre' },
      { eq: 'machine', nameEn: 'Machine Chest Press', nameFr: 'Développé couché machine' },
      { eq: 'smith_machine', nameEn: 'Smith Machine Bench Press', nameFr: 'Développé couché guidé' },
    ]
  },
  {
    baseId: 'overhead_press',
    nameEn: 'Overhead Press (OHP)',
    nameFr: 'Développé militaire / épaules',
    archetype: 'push',
    countingKey: 'overhead_press',
    primary: ['anterior_deltoid', 'lateral_deltoid'],
    secondary: ['triceps', 'trapezius', 'core'],
    setupEn: 'Hold bar at collarbone, forearms vertical, glutes and abs clenched tight.',
    setupFr: 'Barre au niveau des clavicules, avant-bras verticaux, abdos et fessiers serrés.',
    cuesEn: ['Press bar upward clearing chin by moving head slightly back', 'Push head through window once bar clears forehead', 'Lock out directly over mid-foot with active traps'],
    cuesFr: ['Poussez vers le haut en reculant légèrement la tête pour laisser passer la barre', 'Avancez la tête sous la barre dès qu’elle dépasse le front', 'Verrouillez au-dessus des épaules, trapèzes engagés'],
    hypertrophyEn: ['Avoid hyperextending the lumbar spine by bracing core and glutes', 'Lower the load with a 2-second eccentric to deep collarbone stretch'],
    hypertrophyFr: ['Évitez de cambrer les lombaires en maintenant un gainage pelvien strict', 'Descendez en 2 secondes jusqu’aux clavicules pour un étirement complet'],
    equipmentVariants: [
      { eq: 'barbell', nameEn: 'Standing Barbell Overhead Press', nameFr: 'Développé militaire debout barre' },
      { eq: 'barbell', nameEn: 'Seated Barbell Overhead Press', nameFr: 'Développé épaules assis barre' },
      { eq: 'dumbbell', nameEn: 'Seated Dumbbell Shoulder Press', nameFr: 'Développé assis aux haltères' },
      { eq: 'dumbbell', nameEn: 'Standing Dumbbell Shoulder Press', nameFr: 'Développé debout aux haltères' },
      { eq: 'dumbbell', nameEn: 'Arnold Press', nameFr: 'Développé Arnold' },
      { eq: 'machine', nameEn: 'Machine Shoulder Press', nameFr: 'Développé épaules machine' },
      { eq: 'smith_machine', nameEn: 'Smith Machine Shoulder Press', nameFr: 'Développé épaules guidé' },
      { eq: 'barbell', nameEn: 'Z-Press', nameFr: 'Z-Press assis au sol' },
    ]
  },
  {
    baseId: 'dip',
    nameEn: 'Dip',
    nameFr: 'Dips',
    archetype: 'push',
    countingKey: 'dip',
    primary: ['triceps', 'pectoralis_major'],
    secondary: ['anterior_deltoid'],
    setupEn: 'Mount parallel bars, arms locked out, shoulders depressed away from ears.',
    setupFr: 'En appui sur les barres parallèles, bras tendus, épaules basses éloignées des oreilles.',
    cuesEn: ['Lean slightly forward for chest or remain upright for triceps', 'Lower until upper arms reach parallel with floor (90 degree elbow bend)', 'Press forcefully back to top lockout'],
    cuesFr: ['Buste penché pour la poitrine ou droit pour les triceps', 'Descendez jusqu’à ce que le coude atteigne 90 degrés', 'Repoussez puissamment jusqu’au verrouillage'],
    hypertrophyEn: ['Do not sink too deep past shoulder mobility comfort to protect anterior capsule', 'Control descent to eliminate ballistic recoil at bottom'],
    hypertrophyFr: ['Ne descendez pas au-delà de votre mobilité pour protéger les épaules', 'Contrôlez la descente sans rebond brutal en bas'],
    equipmentVariants: [
      { eq: 'bodyweight', nameEn: 'Bodyweight Dip', nameFr: 'Dips au poids de corps' },
      { eq: 'bodyweight', nameEn: 'Chest-Focused Dip', nameFr: 'Dips focus pectoraux' },
      { eq: 'bodyweight', nameEn: 'Tricep-Focused Dip', nameFr: 'Dips focus triceps' },
      { eq: 'bodyweight', nameEn: 'Weighted Dip', nameFr: 'Dips lestés' },
      { eq: 'machine', nameEn: 'Assisted Dip Machine', nameFr: 'Dips assistés machine' },
      { eq: 'machine', nameEn: 'Seated Dip Machine', nameFr: 'Machine à dips assise' },
      { eq: 'bodyweight', nameEn: 'Bench Dip', nameFr: 'Dips sur banc' },
    ]
  },

  // --- UPPER BODY / HORIZONTAL & VERTICAL PULL (Archetype: pull) ---
  {
    baseId: 'pull_up',
    nameEn: 'Pull-Up',
    nameFr: 'Traction',
    archetype: 'pull',
    countingKey: 'pull_up',
    primary: ['latissimus_dorsi'],
    secondary: ['biceps', 'rhomboids', 'trapezius', 'forearms'],
    setupEn: 'Hang from overhead bar with hands slightly wider than shoulders, core tight.',
    setupFr: 'Suspendu à la barre fixe, mains légèrement plus larges que les épaules, gainé.',
    cuesEn: ['Initiate by depressing and retracting shoulder blades', 'Drive elbows straight down toward ribs', 'Pull until chin clears bar, lower with control to dead hang'],
    cuesFr: ['Initiez le tirage en abaissant les omoplates', 'Tirez les coudes vers le bas et les hanches', 'Montez jusqu’au menton au-dessus de la barre, descendez bras tendus'],
    hypertrophyEn: ['Avoid swinging legs or using kipping momentum', 'Spend a full second in the bottom lengthened hang to maximize lat stretch'],
    hypertrophyFr: ['Éliminez tout balancement des jambes ou élan de hanches', 'Passez par une extension complète en bas pour étirer le grand dorsal'],
    equipmentVariants: [
      { eq: 'bodyweight', nameEn: 'Overhand Pull-Up', nameFr: 'Traction pronation' },
      { eq: 'bodyweight', nameEn: 'Underhand Chin-Up', nameFr: 'Traction supination (Chin-Up)' },
      { eq: 'bodyweight', nameEn: 'Neutral Grip Pull-Up', nameFr: 'Traction prise neutre' },
      { eq: 'bodyweight', nameEn: 'Wide Grip Pull-Up', nameFr: 'Traction prise large' },
      { eq: 'bodyweight', nameEn: 'Weighted Pull-Up', nameFr: 'Traction lestée' },
      { eq: 'machine', nameEn: 'Assisted Pull-Up Machine', nameFr: 'Traction assistée machine' },
      { eq: 'bodyweight', nameEn: 'Commando Pull-Up', nameFr: 'Traction commando' },
    ]
  },
  {
    baseId: 'lat_pulldown',
    nameEn: 'Lat Pulldown',
    nameFr: 'Tirage vertical à la poulie',
    archetype: 'pull',
    countingKey: 'lat_pulldown',
    primary: ['latissimus_dorsi'],
    secondary: ['biceps', 'rhomboids', 'rear_deltoid'],
    setupEn: 'Sit with thighs snug under pads, grip bar wider than shoulders, torso upright.',
    setupFr: 'Assis cuisses calées sous les boudins, saisissez la barre plus large que les épaules.',
    cuesEn: ['Lean back no more than 10-15 degrees', 'Pull bar smoothly to upper chest driving elbows down', 'Return bar slowly to full overhead reach feeling lat stretch'],
    cuesFr: ['Inclinez le buste de 10 à 15 degrés maximum', 'Tirez la barre vers le haut de la poitrine, coudes vers le bas', 'Remontez lentement jusqu’au bras tendus pour étirer le dos'],
    hypertrophyEn: ['Do not use body swing or momentum to yank the stack', 'Control the eccentric for 2–3 seconds to leverage the lengthened lat position'],
    hypertrophyFr: ['Ne balancez pas le buste d’avant en arrière pour soulever la charge', 'Contrôlez la phase de retour sur 2 à 3 secondes'],
    equipmentVariants: [
      { eq: 'cable', nameEn: 'Wide-Grip Lat Pulldown', nameFr: 'Tirage poitrine prise large' },
      { eq: 'cable', nameEn: 'Neutral-Grip Lat Pulldown', nameFr: 'Tirage vertical prise neutre' },
      { eq: 'cable', nameEn: 'Reverse-Grip Lat Pulldown', nameFr: 'Tirage vertical prise inversée' },
      { eq: 'cable', nameEn: 'Single-Arm Cable Pulldown', nameFr: 'Tirage vertical unilatéral' },
      { eq: 'machine', nameEn: 'Plate-Loaded Lat Pulldown', nameFr: 'Tirage vertical convergent machine' },
      { eq: 'cable', nameEn: 'Straight-Arm Cable Pulldown', nameFr: 'Pull-over à la poulie haute' },
    ]
  },
  {
    baseId: 'row',
    nameEn: 'Row',
    nameFr: 'Rowing / Tirage horizontal',
    archetype: 'pull',
    countingKey: 'seated_row',
    primary: ['latissimus_dorsi', 'rhomboids', 'trapezius'],
    secondary: ['biceps', 'rear_deltoid', 'erector_spinae'],
    setupEn: 'Hinge forward or sit with chest supported, spine straight, arms extended forward.',
    setupFr: 'Buste penché ou calé au support, colonne droite, bras tendus vers l’avant.',
    cuesEn: ['Retract shoulder blades as you drive elbows back past torso', 'Squeeze mid-back at contraction', 'Lower weight smoothly without rounding spine forward'],
    cuesFr: ['Resserrez les omoplates en tirant les coudes le long du buste', 'Contractez le dos en fin de course', 'Contrôlez le retour sans relâcher les épaules'],
    hypertrophyEn: ['Eliminate torso jerking to ensure load remains on back musculature', 'Let scapulae protract fully at bottom stretch before initiating row'],
    hypertrophyFr: ['Bannissez tout à-coup du buste pour garder la tension sur le dos', 'Laissez les omoplates s’étirer vers l’avant avant de réenclencher'],
    equipmentVariants: [
      { eq: 'cable', nameEn: 'Seated Cable Row', nameFr: 'Tirage horizontal à la poulie' },
      { eq: 'barbell', nameEn: 'Bent-Over Barbell Row', nameFr: 'Rowing barre penché' },
      { eq: 'barbell', nameEn: 'Pendlay Row', nameFr: 'Rowing Pendlay' },
      { eq: 'dumbbell', nameEn: 'Single-Arm Dumbbell Row', nameFr: 'Rowing unilatéral à l’haltère' },
      { eq: 'dumbbell', nameEn: 'Chest-Supported Incline Row', nameFr: 'Rowing haltères sur banc incliné' },
      { eq: 'machine', nameEn: 'Machine T-Bar Row', nameFr: 'T-Bar Row machine' },
      { eq: 'machine', nameEn: 'Chest-Supported Machine Row', nameFr: 'Rowing machine guidé' },
      { eq: 'cable', nameEn: 'Single-Arm Seated Cable Row', nameFr: 'Tirage horizontal unilatéral poulie' },
    ]
  },

  // --- ISOLATIONS / ARMS & SHOULDERS (Archetype: isolation) ---
  {
    baseId: 'bicep_curl',
    nameEn: 'Bicep Curl',
    nameFr: 'Curl biceps',
    archetype: 'isolation',
    countingKey: 'bicep_curl',
    primary: ['biceps'],
    secondary: ['brachialis', 'brachioradialis', 'forearms'],
    setupEn: 'Stand or sit with chest open, elbows pinned slightly in front of torso.',
    setupFr: 'Debout ou assis, poitrine ouverte, coudes calés légèrement en avant du buste.',
    cuesEn: ['Keep upper arms stationary without swinging elbows forward or back', 'Curl weight by flexing elbows fully with supinated wrists', 'Lower weight smoothly through complete elbow extension'],
    cuesFr: ['Gardez les bras immobiles sans balancer les coudes', 'Fléchissez les coudes en tournant les paumes vers le haut', 'Descendez jusqu’à l’extension complète du coude'],
    hypertrophyEn: ['Maintain full control at turnaround rather than using hip bounce to start the lift', 'Control eccentric descent for maximum hypertrophic mechanical tension'],
    hypertrophyFr: ['Ne balancez pas le bassin pour donner de l’élan au départ', 'Freinez la descente pour stimuler la croissance musculaire sous tension'],
    equipmentVariants: [
      { eq: 'barbell', nameEn: 'Standing Barbell Curl', nameFr: 'Curl barre debout' },
      { eq: 'barbell', nameEn: 'EZ-Bar Curl', nameFr: 'Curl barre EZ' },
      { eq: 'dumbbell', nameEn: 'Dumbbell Bicep Curl', nameFr: 'Curl aux haltères' },
      { eq: 'dumbbell', nameEn: 'Incline Dumbbell Curl', nameFr: 'Curl incliné aux haltères' },
      { eq: 'dumbbell', nameEn: 'Hammer Curl', nameFr: 'Curl marteau aux haltères' },
      { eq: 'dumbbell', nameEn: 'Preacher Curl', nameFr: 'Curl au pupitre Larry Scott' },
      { eq: 'dumbbell', nameEn: 'Concentration Curl', nameFr: 'Curl concentré' },
      { eq: 'dumbbell', nameEn: 'Spider Curl', nameFr: 'Spider Curl sur banc incliné' },
      { eq: 'cable', nameEn: 'Cable Bicep Curl', nameFr: 'Curl à la poulie basse' },
      { eq: 'cable', nameEn: 'Bayesian Cable Curl', nameFr: 'Curl bayésien à la poulie' },
      { eq: 'machine', nameEn: 'Machine Bicep Curl', nameFr: 'Curl machine' },
    ]
  },
  {
    baseId: 'tricep_pushdown',
    nameEn: 'Tricep Pushdown & Extension',
    nameFr: 'Extension triceps / Tirage corde',
    archetype: 'isolation',
    countingKey: 'triceps_pushdown',
    primary: ['triceps'],
    secondary: ['forearms'],
    setupEn: 'Stand facing cable pulley, grip attachment with elbows pinned to ribs.',
    setupFr: 'Face à la poulie, coudes collés aux côtes, saisissez l’accessoire.',
    cuesEn: ['Keep upper arms locked in place as hinges', 'Push attachment down until elbows are fully extended', 'Control the return until forearms are past parallel with floor'],
    cuesFr: ['Gardez les bras fixes comme des pivots', 'Poussez vers le bas jusqu’à l’extension complète des coudes', 'Remontez avec contrôle jusqu’au-dessus de l’horizontale'],
    hypertrophyEn: ['Hold 1-second full lockout contraction to stress lateral and medial heads', 'Do not let shoulders roll forward or lean body over the cable to press'],
    hypertrophyFr: ['Marquez un temps d’arrêt d’1 seconde bras tendus', 'Ne penchez pas tout votre poids au-dessus de la poulie'],
    equipmentVariants: [
      { eq: 'cable', nameEn: 'Tricep Rope Pushdown', nameFr: 'Extension triceps à la corde' },
      { eq: 'cable', nameEn: 'Straight Bar Pushdown', nameFr: 'Poussée triceps barre droite' },
      { eq: 'cable', nameEn: 'V-Bar Tricep Pushdown', nameFr: 'Poussée triceps barre en V' },
      { eq: 'barbell', nameEn: 'Skull Crusher', nameFr: 'Barre au front (Skull Crusher)' },
      { eq: 'dumbbell', nameEn: 'Dumbbell Skull Crusher', nameFr: 'Barre au front aux haltères' },
      { eq: 'cable', nameEn: 'Overhead Cable Triceps Extension', nameFr: 'Extension triceps nuque à la poulie' },
      { eq: 'dumbbell', nameEn: 'Overhead Dumbbell Triceps Extension', nameFr: 'Extension triceps nuque à l’haltère' },
      { eq: 'dumbbell', nameEn: 'Tricep Kickback', nameFr: 'Kickback aux haltères' },
      { eq: 'cable', nameEn: 'Single-Arm Cable Pushdown', nameFr: 'Extension triceps unilatérale poulie' },
    ]
  },
  {
    baseId: 'lateral_raise',
    nameEn: 'Lateral Raise',
    nameFr: 'Élévations latérales',
    archetype: 'isolation',
    countingKey: 'lateral_raise',
    primary: ['lateral_deltoid'],
    secondary: ['trapezius', 'anterior_deltoid'],
    setupEn: 'Stand or sit with slight forward torso tilt, weights at sides, elbows slightly unlocked.',
    setupFr: 'Debout ou assis, buste très légèrement penché, haltères le long du corps.',
    cuesEn: ['Raise arms out in the scapular plane (30 degrees forward)', 'Lead with elbows and lateral deltoids until arms reach shoulder height', 'Lower with control over 2 seconds without bouncing at hips'],
    cuesFr: ['Levez les bras dans le plan de l’omoplate (30° vers l’avant)', 'Montez les coudes jusqu’à la hauteur des épaules', 'Freinez la descente en 2 secondes sans rebondir sur les cuisses'],
    hypertrophyEn: ['Eliminate swinging momentum from legs or hips; freeze torso', 'Maintain slight inward hand pour at top to target side deltoid head strictly'],
    hypertrophyFr: ['Bannissez tout balancement du corps ou à-coup des genoux', 'Gardez le contrôle complet à la descente'],
    equipmentVariants: [
      { eq: 'dumbbell', nameEn: 'Dumbbell Lateral Raise', nameFr: 'Élévations latérales aux haltères' },
      { eq: 'dumbbell', nameEn: 'Seated Dumbbell Lateral Raise', nameFr: 'Élévations latérales assises' },
      { eq: 'cable', nameEn: 'Cable Lateral Raise', nameFr: 'Élévations latérales à la poulie' },
      { eq: 'cable', nameEn: 'Behind-the-Back Cable Lateral Raise', nameFr: 'Élévations latérales poulie derrière le dos' },
      { eq: 'machine', nameEn: 'Machine Lateral Raise', nameFr: 'Élévations latérales machine' },
      { eq: 'dumbbell', nameEn: 'Dumbbell Rear Delt Fly', nameFr: 'Oiseau aux haltères (Deltoïde arrière)' },
      { eq: 'machine', nameEn: 'Reverse Pec-Deck Fly', nameFr: 'Pec-Deck inversé (Oiseau machine)' },
      { eq: 'cable', nameEn: 'Cable Face Pull', nameFr: 'Face Pull à la poulie' },
    ]
  },

  // --- CORE & SPINAL ERGONOMICS (Archetype: isolation) ---
  {
    baseId: 'core_knee_raise',
    nameEn: 'Hanging / Captains Chair Knee Raise',
    nameFr: 'Relevé de genoux / jambes',
    archetype: 'isolation',
    countingKey: 'captains_chair_knee_raise',
    primary: ['rectus_abdominis', 'iliopsoas'],
    secondary: ['obliques'],
    setupEn: 'Support forearms in captain’s chair or hang from bar, torso vertical, legs extended.',
    setupFr: 'En appui sur les avant-bras de la chaise romaine ou suspendu, corps vertical.',
    cuesEn: ['Do not swing body; keep back pressed to backrest', 'Curl knees up by tilting pelvis upward toward chest', 'Lower legs slowly without arching lumbar spine'],
    cuesFr: ['Ne balancez pas le corps, dos maintenu au dossier', 'Montez les genoux en enroulant le bassin vers la poitrine', 'Redescendez lentement sans cambrer les lombaires'],
    hypertrophyEn: ['Actively tilt and roll the pelvis up rather than just flexing hip flexors', 'Control the eccentric drop to prevent spinal hyperextension'],
    hypertrophyFr: ['Enroulez activement le bassin pour recruter le grand droit', 'Freinez la descente pour éviter les à-coups sur le bas du dos'],
    equipmentVariants: [
      { eq: 'machine', nameEn: 'Captains Chair Knee Raise', nameFr: 'Relevé de genoux sur chaise romaine' },
      { eq: 'machine', nameEn: 'Captains Chair Leg Raise', nameFr: 'Relevé de jambes tendues chaise romaine' },
      { eq: 'bodyweight', nameEn: 'Hanging Knee Raise', nameFr: 'Relevé de genoux suspendu à la barre' },
      { eq: 'bodyweight', nameEn: 'Hanging Leg Raise', nameFr: 'Relevé de jambes suspendu à la barre' },
      { eq: 'cable', nameEn: 'Cable Kneeling Crunch', nameFr: 'Crunch à la poulie haute à genoux' },
      { eq: 'machine', nameEn: 'Abdominal Crunch Machine', nameFr: 'Machine à abdominaux guidée' },
    ]
  },
  {
    baseId: 'back_extension',
    nameEn: 'Back Extension / Hyperextension',
    nameFr: 'Banc à lombaires / Hyperextension',
    archetype: 'hinge',
    countingKey: 'back_extension',
    primary: ['erector_spinae'],
    secondary: ['glutes', 'hamstrings'],
    setupEn: 'Lock ankles behind roller pads on 45° or 90° bench, pad below hip crease.',
    setupFr: 'Caler les chevilles sous les boudins, bassin contre le coussin sous les hanches.',
    cuesEn: ['Cross arms over chest or hold weight', 'Hinge forward lowering torso smoothly', 'Extend back up until body forms a straight line'],
    cuesFr: ['Bras croisés sur la poitrine ou tenant une charge', 'Fléchissez le buste vers le sol avec fluidité', 'Remontez jusqu’à aligner le corps sans hyperextension excessive'],
    hypertrophyEn: ['Avoid aggressive hyperextension past neutral spine', 'Squeeze spinal erectors and glutes smoothly at top'],
    hypertrophyFr: ['Ne cambrez pas exagérément au sommet du mouvement', 'Contractez les spinaux et fessiers avec fluidité'],
    equipmentVariants: [
      { eq: 'machine', nameEn: '45-Degree Hyperextension', nameFr: 'Extension du dos sur banc 45°' },
      { eq: 'machine', nameEn: '90-Degree Horizontal Back Extension', nameFr: 'Banc lombaire horizontal 90°' },
      { eq: 'machine', nameEn: 'Machine Seated Back Extension', nameFr: 'Extension du dos assis machine' },
      { eq: 'machine', nameEn: 'Reverse Hyperextension', nameFr: 'Reverse Hyperextension machine' },
    ]
  }
];

const MODIFIERS = [
  { id: 'standard', nameEn: '', nameFr: '', cueEn: '', cueFr: '' },
  { id: 'pause', nameEn: 'Pause', nameFr: 'avec pause', cueEn: 'Hold 1.5s pause at maximum stretch point.', cueFr: 'Marquez 1.5s de pause à l’étirement maximal.' },
  { id: 'tempo', nameEn: 'Tempo 3-1-1', nameFr: 'Tempo lent 3-1-1', cueEn: 'Controlled 3-second eccentric phase.', cueFr: 'Phase excentrique ralentie sur 3 secondes.' },
  { id: 'eccentric', nameEn: 'Slow Eccentric', nameFr: 'Excentrique accentuée', cueEn: 'Lower weight slowly under constant mechanical tension.', cueFr: 'Freinez la descente sous tension mécanique continue.' },
  { id: '1_5_rep', nameEn: '1.5 Reps', nameFr: '1.5 Répétitions', cueEn: 'Perform half rep in bottom stretch before full lockout.', cueFr: 'Faites une demi-répétition dans l’étirement avant la remontée complète.' },
  { id: 'cluster', nameEn: 'Rest-Pause', nameFr: 'Rest-Pause', cueEn: 'Brief 10s inter-rep breathing pause for high intensity.', cueFr: 'Courte pause de respiration de 10s pour intensité maximale.' },
  { id: 'drop_set', nameEn: 'Drop Set', nameFr: 'Dégressif', cueEn: 'Reduce load by 20% upon failure to prolong stimulus.', cueFr: 'Réduisez la charge de 20% à l’échec pour prolonger le stimulus.' },
  { id: 'constant_tension', nameEn: 'Constant Tension', nameFr: 'Tension continue', cueEn: 'Reverse movement just before lockout to keep muscles firing.', cueFr: 'Inversez avant le verrouillage pour garder le muscle actif.' },
  { id: 'lengthened_partials', nameEn: 'Lengthened Partials', nameFr: 'Répétitions partielles étirées', cueEn: 'Perform reps in the deep stretched half of the movement.', cueFr: 'Effectuez les répétitions dans la moitié étirée du mouvement.' },
];

// Clean, compact schema
const archetypes = {};
for (const b of BASE_MOVEMENTS) {
  archetypes[b.baseId] = {
    baseId: b.baseId,
    archetype: b.archetype,
    countingKey: b.countingKey,
    primary: b.primary,
    secondary: b.secondary,
    setupEn: b.setupEn,
    setupFr: b.setupFr,
    cuesEn: b.cuesEn,
    cuesFr: b.cuesFr,
    hypertrophyEn: b.hypertrophyEn,
    hypertrophyFr: b.hypertrophyFr,
  };
}

const modifiers = {};
for (const m of MODIFIERS) {
  modifiers[m.id] = {
    id: m.id,
    nameEn: m.nameEn,
    nameFr: m.nameFr,
    cueEn: m.cueEn,
    cueFr: m.cueFr
  };
}

const entries = [];
for (const base of BASE_MOVEMENTS) {
  for (const ev of base.equipmentVariants) {
    for (const mod of MODIFIERS) {
      const slug = `${ev.nameEn.toLowerCase().replace(/[^a-z0-9]+/g, '_')}${mod.id !== 'standard' ? `_${mod.id}` : ''}`;
      const modEn = mod.nameEn ? ` (${mod.nameEn})` : '';
      const modFr = mod.nameFr ? ` (${mod.nameFr})` : '';
      
      entries.push({
        id: slug,
        name: `${ev.nameEn}${modEn}`,
        name_fr: `${ev.nameFr}${modFr}`,
        base: base.baseId,
        eq: ev.eq,
        mod: mod.id,
      });
    }
  }
}

const database = {
  version: '1.0.0',
  count: entries.length,
  archetypes,
  modifiers,
  entries
};

fs.writeFileSync(outPath, JSON.stringify(database), 'utf-8');
const sizeKb = (fs.statSync(outPath).size / 1024).toFixed(1);
console.log(`Generated ${entries.length} normalized exercise entries. Total size: ${sizeKb} KB.`);
