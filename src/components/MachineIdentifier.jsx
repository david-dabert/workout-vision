import { useState, useRef, useEffect } from 'react';
import { getImageLandmarker, detectPoseImage } from '../lib/poseAnalysis';
import { extractJointAngles } from '../lib/poseAnalysis';
import { EXERCISES } from '../lib/exercises';
import { EQUIPMENT_CATALOG, searchEquipment } from '../lib/machineIdentifier';
import { t, tExercise, onLangChange } from '../lib/i18n';

export default function MachineIdentifier({ onSelectExercise, onClose }) {
  const [, setLangTick] = useState(0);
  useEffect(() => onLangChange(() => setLangTick(n => n + 1)), []);
  const [mode, setMode] = useState('choose'); // 'choose' | 'photo' | 'catalog'
  const [photo, setPhoto] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState(null);
  const [search, setSearch] = useState('');
  const fileInputRef = useRef(null);
  const canvasRef = useRef(null);

  const handleCapture = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    const url = URL.createObjectURL(file);
    setPhoto(url);
    setMode('photo');
    setAnalyzing(true);
    setResult(null);

    try {
      // Load image into an offscreen element for pose detection
      const img = new Image();
      img.crossOrigin = 'anonymous';
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = url;
      });

      const landmarker = await getImageLandmarker();
      if (!landmarker) {
        setResult({ type: 'no_model' });
        setAnalyzing(false);
        return;
      }

      // Draw image to canvas for detection
      const canvas = canvasRef.current;
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);

      const detection = detectPoseImage(landmarker, canvas);

      if (detection && detection.landmarks && detection.landmarks.length > 0) {
        const landmarks = detection.landmarks[0];
        const angles = extractJointAngles(landmarks);

        if (angles) {
          // Try to identify from pose
          const identified = identifyFromAngles(angles);
          if (identified) {
            setResult({
              type: 'identified',
              exercise: identified.exercise,
              exerciseName: EXERCISES[identified.exercise]?.name || identified.exercise,
              confidence: identified.confidence,
              angles,
            });
          } else {
            setResult({ type: 'person_no_match', angles });
          }
        } else {
          setResult({ type: 'person_no_match' });
        }
      } else {
        // No person detected — show catalog
        setResult({ type: 'no_person' });
      }
    } catch (err) {
      console.error('Machine identification error:', err);
      setResult({ type: 'error' });
    }

    setAnalyzing(false);
  };

  const handleSelectFromCatalog = (key) => {
    onSelectExercise(key);
  };

  const filteredCatalog = searchEquipment(search);

  return (
    <div className="page">
      <div className="page-header">
        <h2>{t('identify_machine')}</h2>
        <button className="btn btn-ghost btn-sm" onClick={onClose}>{t('close')}</button>
      </div>

      {mode === 'choose' && (
        <>
          <div className="card" style={{ textAlign: 'center', padding: 24 }}>
            <p className="text-sm" style={{ color: '#fff', marginBottom: 16, lineHeight: 1.5 }}>
              Take a photo of the gym machine or yourself on it, and the app will identify the exercise.
            </p>

            <div style={{ display: 'flex', gap: 8, flexDirection: 'column' }}>
              <button
                className="btn btn-primary btn-lg"
                onClick={() => fileInputRef.current?.click()}
                style={{ width: '100%' }}
              >
                {t('take_photo')}
              </button>
              <button
                className="btn btn-ghost"
                onClick={() => setMode('catalog')}
                style={{ width: '100%' }}
              >
                {t('browse_catalog')}
              </button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleCapture}
              style={{ display: 'none' }}
            />
          </div>

          <div className="card" style={{ marginTop: 8 }}>
            <h4 style={{ margin: '0 0 8px' }}>{t('how_it_works')}</h4>
            <div className="steps">
              <div className="step-row">
                <span className="step-n">1</span>
                <span className="text-sm">{t('step_photo')}</span>
              </div>
              <div className="step-row">
                <span className="step-n">2</span>
                <span className="text-sm">{t('step_detect')}</span>
              </div>
              <div className="step-row">
                <span className="step-n">3</span>
                <span className="text-sm">{t('step_start')}</span>
              </div>
            </div>
          </div>
        </>
      )}

      {mode === 'photo' && (
        <>
          <div className="card" style={{ padding: 8 }}>
            <div style={{ position: 'relative', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
              {photo && <img src={photo} alt="Captured" style={{ width: '100%', display: 'block', borderRadius: 'var(--radius-sm)' }} />}
              <canvas ref={canvasRef} style={{ display: 'none' }} />
            </div>
          </div>

          {analyzing && (
            <div className="card" style={{ textAlign: 'center', padding: 20 }}>
              <div className="spinner" />
              <p className="text-sm" style={{ color: '#fff' }}>{t('analyzing_pose')}</p>
            </div>
          )}

          {result && result.type === 'identified' && (
            <div className="card card-accent" style={{ textAlign: 'center', padding: 20 }}>
              <p className="text-xs text-muted" style={{ marginBottom: 4 }}>{t('exercise_detected')}</p>
              <h3 style={{ marginBottom: 8, color: 'var(--accent)' }}>{tExercise(result.exercise, result.exerciseName)}</h3>
              <p className="text-xs text-muted" style={{ marginBottom: 14 }}>
                {t('confidence')} {Math.round(result.confidence * 100)}%
              </p>
              <button
                className="btn btn-primary"
                onClick={() => handleSelectFromCatalog(result.exercise)}
                style={{ width: '100%', marginBottom: 8 }}
              >
                {t('use_this_exercise')}
              </button>
              <button
                className="btn btn-ghost"
                onClick={() => setMode('catalog')}
                style={{ width: '100%' }}
              >
                {t('not_right_browse')}
              </button>
            </div>
          )}

          {result && (result.type === 'no_person' || result.type === 'person_no_match') && (
            <div className="card" style={{ textAlign: 'center', padding: 20 }}>
              <p className="text-sm" style={{ color: '#fff', marginBottom: 4 }}>
                {result.type === 'no_person'
                  ? t('no_person_detected')
                  : "Couldn't identify the exercise from your pose"}
              </p>
              <p className="text-xs text-muted" style={{ marginBottom: 14 }}>
                Browse the equipment catalog to find your machine
              </p>
              <button
                className="btn btn-primary"
                onClick={() => setMode('catalog')}
                style={{ width: '100%', marginBottom: 8 }}
              >
                {t('browse_catalog')}
              </button>
              <button
                className="btn btn-ghost"
                onClick={() => { setMode('choose'); setPhoto(null); setResult(null); }}
                style={{ width: '100%' }}
              >
                {t('try_another_photo')}
              </button>
            </div>
          )}

          {result && result.type === 'no_model' && (
            <div className="card" style={{ textAlign: 'center', padding: 20 }}>
              <p className="text-sm" style={{ color: 'var(--yellow)' }}>
                Pose model still loading. Try the catalog instead.
              </p>
              <button
                className="btn btn-primary"
                onClick={() => setMode('catalog')}
                style={{ width: '100%', marginTop: 10 }}
              >
                {t('browse_catalog')}
              </button>
            </div>
          )}

          {result && result.type === 'error' && (
            <div className="card" style={{ textAlign: 'center', padding: 20 }}>
              <p className="text-sm" style={{ color: 'var(--red)', marginBottom: 10 }}>
                Something went wrong analyzing the photo
              </p>
              <button
                className="btn btn-ghost"
                onClick={() => { setMode('choose'); setPhoto(null); setResult(null); }}
                style={{ width: '100%' }}
              >
                Try again
              </button>
            </div>
          )}
        </>
      )}

      {mode === 'catalog' && (
        <>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('search_machines')}
            style={{ marginBottom: 10 }}
          />

          {filteredCatalog.map(cat => (
            <div key={cat.category} className="card" style={{ marginBottom: 8 }}>
              <h4 style={{ margin: '0 0 8px' }}>
                <span style={{ marginRight: 6 }}>{cat.icon}</span>
                {cat.category}
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {cat.items.map(item => {
                  const ex = EXERCISES[item.key];
                  return (
                    <button
                      key={item.key + item.name}
                      className="catalog-item"
                      onClick={() => handleSelectFromCatalog(item.key)}
                    >
                      <div style={{ flex: 1, textAlign: 'left' }}>
                        <span className="catalog-name">{tExercise(item.key, item.name)}</span>
                        {ex && (
                          <span className="catalog-muscles">
                            {ex.muscles.primary.join(', ')}
                          </span>
                        )}
                      </div>
                      <span style={{ color: 'var(--accent)', fontSize: '0.75rem', fontWeight: 700 }}>{t('select')}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {filteredCatalog.length === 0 && (
            <div className="card" style={{ textAlign: 'center', padding: 20 }}>
              <p className="text-sm text-muted">No machines found for "{search}"</p>
            </div>
          )}

          <button
            className="btn btn-ghost"
            onClick={() => { setMode('choose'); setSearch(''); }}
            style={{ width: '100%', marginTop: 8 }}
          >
            {t('back')}
          </button>
        </>
      )}
    </div>
  );
}


function identifyFromAngles(angles) {
  const trunk = angles.trunk;
  const knee = Math.min(angles.leftKnee, angles.rightKnee);
  const elbow = Math.min(angles.leftElbow, angles.rightElbow);
  const shoulder = (angles.leftShoulder + angles.rightShoulder) / 2;

  // Standing with bent knees → squat family
  if (trunk < 30 && knee < 130) {
    if (shoulder > 120) return { exercise: 'overhead_press', confidence: 0.6 };
    return { exercise: 'squat', confidence: 0.7 };
  }

  // Arms overhead, body straight → pull-up / lat pulldown
  if (shoulder > 140) {
    if (trunk < 20) return { exercise: 'pull_up', confidence: 0.6 };
    return { exercise: 'lat_pulldown', confidence: 0.5 };
  }

  // Bent over (trunk > 40, standing)
  if (trunk > 40 && knee > 140) {
    if (elbow < 120) return { exercise: 'bent_over_row', confidence: 0.6 };
    return { exercise: 'romanian_deadlift', confidence: 0.5 };
  }

  // Seated (trunk moderate, knees ~90)
  if (knee > 70 && knee < 110 && trunk < 30) {
    if (elbow < 100) return { exercise: 'seated_row', confidence: 0.5 };
    if (shoulder > 60) return { exercise: 'lat_pulldown', confidence: 0.5 };
    return { exercise: 'machine_chest_press', confidence: 0.4 };
  }

  // Arms working, standing straight → curl or raise
  if (trunk < 20 && knee > 150) {
    if (elbow < 90) return { exercise: 'bicep_curl', confidence: 0.7 };
    if (shoulder > 60 && shoulder < 120) return { exercise: 'lateral_raise', confidence: 0.5 };
    return { exercise: 'tricep_pushdown', confidence: 0.4 };
  }

  // Lying / very leaned back
  if (trunk > 60 && knee > 150) {
    if (elbow < 120) return { exercise: 'bench_press', confidence: 0.6 };
    return { exercise: 'glute_bridge', confidence: 0.4 };
  }

  // Push-up position
  if (trunk > 10 && trunk < 50 && elbow < 130 && knee > 150) {
    return { exercise: 'push_up', confidence: 0.5 };
  }

  return null;
}
