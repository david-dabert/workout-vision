/**
 * MuscleMap — SVG anatomical body visualization.
 * Shows front and back views with highlighted muscle groups.
 * Inspired by premium fitness apps (Hevy, Strong, etc.)
 */

// Muscle group → SVG path data for front and back body views
// Simplified anatomical paths for mobile rendering
const MUSCLE_PATHS = {
  front: {
    // Body outline
    outline: 'M50,8 C55,8 58,12 58,18 L58,22 C62,24 64,28 64,32 L68,34 C72,36 76,40 76,46 L74,56 L70,62 C68,64 66,64 64,62 L60,52 L60,58 C60,62 62,68 62,72 L62,88 L58,96 L54,88 L54,72 C54,72 52,72 50,72 C48,72 46,72 46,72 L46,88 L42,96 L38,88 L38,72 C38,68 40,62 40,58 L40,52 L36,62 C34,64 32,64 30,62 L26,56 L24,46 C24,40 28,36 32,34 L36,32 C36,28 38,24 42,22 L42,18 C42,12 45,8 50,8 Z',
    // Individual muscle groups
    muscles: {
      'Chest': {
        path: 'M42,30 C44,28 48,27 50,27 C52,27 56,28 58,30 L58,36 C56,38 52,39 50,39 C48,39 44,38 42,36 Z',
        color: 'var(--red, #ff3b5c)'
      },
      'Shoulders': {
        path: 'M36,28 C38,26 40,27 42,29 L42,34 C40,36 38,35 36,33 Z M58,29 C60,27 62,26 64,28 L64,33 C62,35 60,36 58,34 Z',
        color: 'var(--red, #ff3b5c)'
      },
      'Biceps': {
        path: 'M34,36 C36,34 38,36 38,40 L36,48 C34,50 32,48 32,44 Z M62,40 C62,36 64,34 66,36 L68,44 C68,48 66,50 64,48 Z',
        color: 'var(--red, #ff3b5c)'
      },
      'Forearms': {
        path: 'M30,50 L34,48 L36,56 L32,58 Z M64,48 L70,50 L68,58 L64,56 Z',
        color: 'var(--red, #ff3b5c)'
      },
      'Abs': {
        path: 'M46,40 L54,40 L54,58 C53,60 51,61 50,61 C49,61 47,60 46,58 Z',
        color: 'var(--red, #ff3b5c)'
      },
      'Core': {
        path: 'M46,40 L54,40 L54,58 C53,60 51,61 50,61 C49,61 47,60 46,58 Z',
        color: 'var(--red, #ff3b5c)'
      },
      'Obliques': {
        path: 'M42,38 L46,40 L46,56 L42,52 Z M54,40 L58,38 L58,52 L54,56 Z',
        color: 'var(--red, #ff3b5c)'
      },
      'Quadriceps': {
        path: 'M42,62 L48,62 L48,80 C47,82 45,83 44,82 L42,78 Z M52,62 L58,62 L58,78 L56,82 C55,83 53,82 52,80 Z',
        color: 'var(--red, #ff3b5c)'
      },
      'Hip Flexors': {
        path: 'M44,58 L48,58 L48,64 L44,64 Z M52,58 L56,58 L56,64 L52,64 Z',
        color: 'var(--red, #ff3b5c)'
      },
      'Calves': {
        path: 'M43,82 L47,82 L46,92 L44,92 Z M53,82 L57,82 L56,92 L54,92 Z',
        color: 'var(--red, #ff3b5c)'
      },
      'Triceps': {
        path: 'M32,36 L36,34 L36,46 L32,44 Z M64,34 L68,36 L68,44 L64,46 Z',
        color: 'var(--red, #ff3b5c)'
      },
    }
  },
  back: {
    outline: 'M50,8 C55,8 58,12 58,18 L58,22 C62,24 64,28 64,32 L68,34 C72,36 76,40 76,46 L74,56 L70,62 C68,64 66,64 64,62 L60,52 L60,58 C60,62 62,68 62,72 L62,88 L58,96 L54,88 L54,72 C54,72 52,72 50,72 C48,72 46,72 46,72 L46,88 L42,96 L38,88 L38,72 C38,68 40,62 40,58 L40,52 L36,62 C34,64 32,64 30,62 L26,56 L24,46 C24,40 28,36 32,34 L36,32 C36,28 38,24 42,22 L42,18 C42,12 45,8 50,8 Z',
    muscles: {
      'Traps': {
        path: 'M44,22 L50,20 L56,22 L56,30 L50,32 L44,30 Z',
        color: 'var(--red, #ff3b5c)'
      },
      'Upper Back': {
        path: 'M42,30 L48,32 L48,40 L42,38 Z M52,32 L58,30 L58,38 L52,40 Z',
        color: 'var(--red, #ff3b5c)'
      },
      'Lats': {
        path: 'M40,34 L44,36 L44,50 L40,46 Z M56,36 L60,34 L60,46 L56,50 Z',
        color: 'var(--red, #ff3b5c)'
      },
      'Rear Delts': {
        path: 'M36,28 L40,30 L40,34 L36,32 Z M60,30 L64,28 L64,32 L60,34 Z',
        color: 'var(--red, #ff3b5c)'
      },
      'Erectors': {
        path: 'M47,40 L50,38 L53,40 L53,58 L50,60 L47,58 Z',
        color: 'var(--red, #ff3b5c)'
      },
      'Lower Back': {
        path: 'M47,40 L50,38 L53,40 L53,58 L50,60 L47,58 Z',
        color: 'var(--red, #ff3b5c)'
      },
      'Glutes': {
        path: 'M42,58 L50,56 L58,58 L58,68 C56,70 54,71 50,71 C46,71 44,70 42,68 Z',
        color: 'var(--red, #ff3b5c)'
      },
      'Hamstrings': {
        path: 'M42,70 L48,70 L48,84 C47,86 45,86 44,84 Z M52,70 L58,70 L56,84 C55,86 53,86 52,84 Z',
        color: 'var(--red, #ff3b5c)'
      },
      'Calves': {
        path: 'M43,84 L47,84 L46,94 L44,94 Z M53,84 L57,84 L56,94 L54,94 Z',
        color: 'var(--red, #ff3b5c)'
      },
      'Triceps': {
        path: 'M32,36 L36,34 L36,46 L32,44 Z M64,34 L68,36 L68,44 L64,46 Z',
        color: 'var(--red, #ff3b5c)'
      },
    }
  }
};

// Normalize muscle names for matching
function normalizeMuscle(name) {
  return name.toLowerCase().replace(/[^a-z]/g, '');
}

// Map exercise muscle names to our SVG muscle keys
const MUSCLE_ALIASES = {
  'quadriceps': ['Quadriceps'],
  'quads': ['Quadriceps'],
  'glutes': ['Glutes'],
  'gluteus': ['Glutes'],
  'gluteusmedius': ['Glutes'],
  'gluteusmaximus': ['Glutes'],
  'hamstrings': ['Hamstrings'],
  'calves': ['Calves'],
  'gastrocnemius': ['Calves'],
  'soleus': ['Calves'],
  'chest': ['Chest'],
  'pectorals': ['Chest'],
  'pecs': ['Chest'],
  'upperpectorals': ['Chest'],
  'shoulders': ['Shoulders'],
  'deltoids': ['Shoulders'],
  'delts': ['Shoulders'],
  'frontdelts': ['Shoulders'],
  'anteriordeltoid': ['Shoulders'],
  'anteriordelts': ['Shoulders'],
  'medialdeltoid': ['Shoulders'],
  'medialdelts': ['Shoulders'],
  'reardelts': ['Rear Delts'],
  'reardeltoid': ['Rear Delts'],
  'posteriordeltoid': ['Rear Delts'],
  'lateraldelts': ['Shoulders'],
  'lateraldeltoid': ['Shoulders'],
  'biceps': ['Biceps'],
  'bicepsbrachii': ['Biceps'],
  'brachialis': ['Biceps'],
  'brachioradialis': ['Forearms'],
  'triceps': ['Triceps'],
  'tricepslonghead': ['Triceps'],
  'forearms': ['Forearms'],
  'wristflexors': ['Forearms'],
  'abs': ['Abs'],
  'abdominals': ['Abs'],
  'core': ['Core', 'Abs'],
  'obliques': ['Obliques'],
  'lats': ['Lats'],
  'latissimusdorsi': ['Lats'],
  'back': ['Upper Back', 'Lats'],
  'upperback': ['Upper Back'],
  'lowerback': ['Lower Back', 'Erectors'],
  'erectors': ['Erectors', 'Lower Back'],
  'spinalerectors': ['Erectors', 'Lower Back'],
  'traps': ['Traps'],
  'trapezius': ['Traps'],
  'hipflexors': ['Hip Flexors'],
  'rhomboids': ['Upper Back'],
  'serratusanterior': ['Obliques'],
  'tibialis': ['Calves'],
  'tibialisanterior': ['Calves'],
  'adductors': ['Quadriceps'],
};

function resolveMuscles(muscleList) {
  const resolved = new Set();
  for (const m of muscleList) {
    const key = normalizeMuscle(m);
    const aliases = MUSCLE_ALIASES[key];
    if (aliases) {
      aliases.forEach(a => resolved.add(a));
    } else {
      // Try direct match
      resolved.add(m);
    }
  }
  return resolved;
}

function BodyView({ view, primaryMuscles, secondaryMuscles, size = 120 }) {
  const data = MUSCLE_PATHS[view];
  if (!data) return null;

  return (
    <svg viewBox="20 4 60 96" width={size} height={size * 1.2} style={{ display: 'block' }}>
      {/* Body outline */}
      <path d={data.outline} fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.15)" strokeWidth="0.8" />

      {/* Muscle highlights */}
      {Object.entries(data.muscles).map(([name, muscle]) => {
        const isPrimary = primaryMuscles.has(name);
        const isSecondary = secondaryMuscles.has(name);
        if (!isPrimary && !isSecondary) return null;

        return (
          <path
            key={name}
            d={muscle.path}
            fill={isPrimary ? 'rgba(0,245,212,0.55)' : 'rgba(0,245,212,0.25)'}
            stroke={isPrimary ? 'rgba(0,245,212,0.8)' : 'rgba(0,245,212,0.4)'}
            strokeWidth="0.4"
            style={{ transition: 'fill 0.3s ease' }}
          />
        );
      })}

      {/* Head circle */}
      <circle cx="50" cy="12" r="6" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.15)" strokeWidth="0.6" />
    </svg>
  );
}

export default function MuscleMap({ muscles, size = 100 }) {
  if (!muscles) return null;

  const primary = resolveMuscles(muscles.primary || []);
  const secondary = resolveMuscles(muscles.secondary || []);

  // Determine which views to show based on muscles
  const backMuscleNames = ['Traps', 'Upper Back', 'Lats', 'Rear Delts', 'Erectors', 'Lower Back', 'Glutes', 'Hamstrings'];
  const hasBackMuscles = [...primary, ...secondary].some(m => backMuscleNames.includes(m));
  const frontMuscleNames = ['Chest', 'Shoulders', 'Biceps', 'Abs', 'Core', 'Obliques', 'Quadriceps', 'Hip Flexors', 'Forearms'];
  const hasFrontMuscles = [...primary, ...secondary].some(m => frontMuscleNames.includes(m));

  return (
    <div className="muscle-map">
      <div className="muscle-map-bodies">
        {(hasFrontMuscles || !hasBackMuscles) && (
          <BodyView view="front" primaryMuscles={primary} secondaryMuscles={secondary} size={size} />
        )}
        {hasBackMuscles && (
          <BodyView view="back" primaryMuscles={primary} secondaryMuscles={secondary} size={size} />
        )}
      </div>
      <div className="muscle-map-legend">
        {[...muscles.primary || []].map(m => (
          <span key={m} className="muscle-dot primary">{m}</span>
        ))}
        {(muscles.secondary || []).slice(0, 3).map(m => (
          <span key={m} className="muscle-dot secondary">{m}</span>
        ))}
      </div>
    </div>
  );
}
