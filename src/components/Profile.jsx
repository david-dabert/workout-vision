import { useState, useEffect, useRef } from 'react';
import {
  calculateBaselines,
  getMedicalRecords, saveMedicalRecord, deleteMedicalRecord,
  getAllWorkouts, getProfile, saveWorkout,
} from '../lib/storage';
import { useProfile } from '../lib/ProfileContext';
import { useT } from '../lib/LanguageContext';
import { detectCapabilities, runMicroBenchmark } from '../lib/gpuBenchmark';

export default function Profile({ onClose }) {
  const { profile: savedProfile, saveProfile } = useProfile();
  const [profile, setProfile] = useState({
    name: '', weight: '', height: '', age: '', sex: 'male', ethnicity: '', activityLevel: 'moderate',
    restingHR: '', experience: 'intermediate', goal: 'general',
    injuries: [],
  });
  const [baselines, setBaselines] = useState(null);
  const [saved, setSaved] = useState(false);
  const [records, setRecords] = useState([]);
  const [benchmarkResult, setBenchmarkResult] = useState(null);
  const [benchmarkRunning, setBenchmarkRunning] = useState(false);
  const fileInputRef = useRef(null);
  const { t, lang, setLang } = useT();

  useEffect(() => {
    if (savedProfile) {
      setProfile(prev => ({ ...prev, ...savedProfile }));
      setBaselines(calculateBaselines(savedProfile));
    }
    getMedicalRecords().then(setRecords);
  }, [savedProfile]);

  const handleSave = async () => {
    await saveProfile(profile);
    setBaselines(calculateBaselines(profile));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleChange = (field, value) => {
    setProfile(prev => ({ ...prev, [field]: value }));
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    if (file.size > MAX_FILE_SIZE) {
      alert(t('file_too_large'));
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const record = {
        name: file.name,
        type: file.type,
        data: reader.result,
        size: file.size,
        notes: '',
      };
      await saveMedicalRecord(record);
      const updated = await getMedicalRecords();
      setRecords(updated);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleDeleteRecord = async (id) => {
    await deleteMedicalRecord(id);
    setRecords(prev => prev.filter(r => r.id !== id));
  };

  return (
    <div className="page">
      <div className="page-header">
        <button className="btn-icon" onClick={onClose} aria-label="Close">
          &#x2715;
        </button>
        <h2>{t('profile')}</h2>
      </div>

      {/* Profile form */}
      <div className="card">
        <div className="form-group">
          <label>{t('language')}</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className={`btn btn-sm ${lang === 'en' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setLang('en')}>English</button>
            <button className={`btn btn-sm ${lang === 'fr' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setLang('fr')}>Français</button>
          </div>
        </div>
        <h3>{t('your_measurements')}</h3>
        <div className="form-grid">
          <label>
            <span>{t('name')}</span>
            <input
              type="text"
              value={profile.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="Your name"
            />
          </label>
          <label>
            <span>{t('age')}</span>
            <input
              type="number"
              value={profile.age}
              onChange={(e) => handleChange('age', e.target.value)}
              placeholder="Years"
            />
          </label>
          <label>
            <span>{t('weight_kg')}</span>
            <input
              type="number"
              value={profile.weight}
              onChange={(e) => handleChange('weight', e.target.value)}
              placeholder="kg"
            />
          </label>
          <label>
            <span>{t('height_cm')}</span>
            <input
              type="number"
              value={profile.height}
              onChange={(e) => handleChange('height', e.target.value)}
              placeholder="cm"
            />
          </label>
          <label>
            <span>{t('sex')}</span>
            <select value={profile.sex} onChange={(e) => handleChange('sex', e.target.value)}>
              <option value="male">{t('male')}</option>
              <option value="female">{t('female')}</option>
            </select>
          </label>
          <label>
            <span>{t('ethnicity')}</span>
            <input
              type="text"
              value={profile.ethnicity}
              onChange={(e) => handleChange('ethnicity', e.target.value)}
              placeholder="Optional"
            />
          </label>
          <label className="full-width">
            <span>{t('activity_level')}</span>
            <select value={profile.activityLevel} onChange={(e) => handleChange('activityLevel', e.target.value)}>
              <option value="sedentary">{t('sedentary')}</option>
              <option value="light">{t('light_activity')}</option>
              <option value="moderate">{t('moderate_activity')}</option>
              <option value="active">{t('active_activity')}</option>
              <option value="veryActive">{t('very_active_activity')}</option>
            </select>
          </label>
          <label>
            <span>{t('resting_hr')}</span>
            <input
              type="number"
              value={profile.restingHR}
              onChange={(e) => handleChange('restingHR', e.target.value)}
              placeholder="e.g. 65"
            />
          </label>
          <label>
            <span>{t('experience')}</span>
            <select value={profile.experience} onChange={(e) => handleChange('experience', e.target.value)}>
              <option value="beginner">{t('beginner')}</option>
              <option value="intermediate">{t('intermediate')}</option>
              <option value="advanced">{t('advanced')}</option>
            </select>
          </label>
          <label>
            <span>{t('goal')}</span>
            <select value={profile.goal} onChange={(e) => handleChange('goal', e.target.value)}>
              <option value="general">{t('general_fitness')}</option>
              <option value="strength">{t('strength')}</option>
              <option value="hypertrophy">{t('muscle_growth')}</option>
              <option value="endurance">{t('endurance')}</option>
              <option value="weight_loss">{t('weight_loss')}</option>
            </select>
          </label>
          <label className="full-width">
            <span>{t('injuries')}</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
              {['lower_back', 'shoulder', 'knee', 'wrist', 'hip', 'ankle', 'neck', 'elbow'].map(area => (
                <button
                  key={area}
                  type="button"
                  onClick={() => {
                    const current = profile.injuries || [];
                    const next = current.includes(area)
                      ? current.filter(i => i !== area)
                      : [...current, area];
                    handleChange('injuries', next);
                  }}
                  style={{
                    padding: '10px 14px', borderRadius: 8, fontSize: '0.78rem', fontWeight: 600,
                    border: '1px solid',
                    borderColor: (profile.injuries || []).includes(area) ? 'var(--red)' : 'var(--border)',
                    background: (profile.injuries || []).includes(area) ? 'rgba(255,61,87,0.15)' : 'transparent',
                    color: (profile.injuries || []).includes(area) ? 'var(--red)' : 'var(--muted)',
                    cursor: 'pointer',
                  }}
                >
                  {area.replace('_', ' ')}
                </button>
              ))}
            </div>
          </label>
        </div>
        <button className="btn btn-primary" onClick={handleSave} style={{ width: '100%' }}>
          {saved ? t('saved') : t('save_profile')}
        </button>
      </div>

      {/* Cycle Tracking (optional) */}
      <div className="card">
        <h3>{t('cycle_tracking')}</h3>
        <p className="text-xs text-muted" style={{ marginBottom: 10 }}>
          {t('cycle_tracking_desc')}
        </p>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginBottom: 12 }}>
          <input
            type="checkbox"
            checked={!!profile.cycleTrackingEnabled}
            onChange={(e) => handleChange('cycleTrackingEnabled', e.target.checked)}
            style={{ width: 18, height: 18, accentColor: 'var(--primary)' }}
          />
          <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{t('enable_cycle_tracking')}</span>
        </label>

        {profile.cycleTrackingEnabled && (
          <>
            <div className="form-grid">
              <label>
                <span>{t('last_period_start')}</span>
                <input
                  type="date"
                  value={profile.cycleLastPeriodStart || ''}
                  onChange={(e) => handleChange('cycleLastPeriodStart', e.target.value)}
                  max={new Date().toISOString().split('T')[0]}
                />
              </label>
              <label>
                <span>{t('cycle_length')}</span>
                <input
                  type="number"
                  value={profile.cycleLength || 28}
                  onChange={(e) => {
                    const v = Math.max(21, Math.min(35, parseInt(e.target.value) || 28));
                    handleChange('cycleLength', v);
                  }}
                  min={21}
                  max={35}
                  placeholder="28"
                />
              </label>
            </div>

            {(() => {
              if (!profile.cycleLastPeriodStart) return null;
              const startDate = new Date(profile.cycleLastPeriodStart);
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              startDate.setHours(0, 0, 0, 0);
              const diffMs = today.getTime() - startDate.getTime();
              if (diffMs < 0) return null;
              const cycleLen = profile.cycleLength || 28;
              const dayInCycle = (Math.floor(diffMs / 86400000) % cycleLen) + 1;

              let phaseKey, tipKey, phaseColor;
              if (dayInCycle <= 5) {
                phaseKey = 'cycle_phase_menstrual';
                tipKey = 'cycle_tip_menstrual';
                phaseColor = '#e8575780';
              } else if (dayInCycle <= 14) {
                phaseKey = 'cycle_phase_follicular';
                tipKey = 'cycle_tip_follicular';
                phaseColor = '#4caf5080';
              } else if (dayInCycle <= 16) {
                phaseKey = 'cycle_phase_ovulatory';
                tipKey = 'cycle_tip_ovulatory';
                phaseColor = '#ff980080';
              } else {
                phaseKey = 'cycle_phase_luteal';
                tipKey = 'cycle_tip_luteal';
                phaseColor = '#7c4dff80';
              }

              return (
                <div style={{
                  marginTop: 12,
                  padding: '12px 14px',
                  borderRadius: 10,
                  background: phaseColor,
                  border: '1px solid var(--border)',
                }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, marginBottom: 4 }}>
                    {t('cycle_current_phase')}: {t(phaseKey)}
                  </div>
                  <div style={{ fontSize: '0.75rem', opacity: 0.85, marginBottom: 4 }}>
                    {t('cycle_day')} {dayInCycle} / {cycleLen}
                  </div>
                  <div style={{ fontSize: '0.78rem', fontStyle: 'italic' }}>
                    {t(tipKey)}
                  </div>
                </div>
              );
            })()}
          </>
        )}
      </div>

      {/* Baselines */}
      {baselines && (
        <div className="card">
          <h3>{t('your_baselines')}</h3>
          <div className="baselines-grid">
            <div className="baseline-item">
              <span className="baseline-value">{baselines.bmi}</span>
              <span className="baseline-label">{t('bmi')}</span>
            </div>
            <div className="baseline-item">
              <span className="baseline-value">{baselines.bmr}</span>
              <span className="baseline-label">{t('bmr')}</span>
            </div>
            <div className="baseline-item">
              <span className="baseline-value">{baselines.estimatedBF}%</span>
              <span className="baseline-label">{t('est_bf')}</span>
            </div>
            <div className="baseline-item">
              <span className="baseline-value">{baselines.maxHR}</span>
              <span className="baseline-label">{t('max_hr_short')}</span>
            </div>
          </div>

          {/* Heart rate zones */}
          <h4>{t('hr_zones_title')}</h4>
          <div className="zones">
            {Object.entries(baselines.zones).map(([name, range]) => (
              <div key={name} className={`zone zone-${name}`}>
                <span className="zone-name">{name.replace(/([A-Z])/g, ' $1')}</span>
                <span className="zone-range">{range.min} - {range.max} bpm</span>
              </div>
            ))}
          </div>

          {/* TDEE */}
          <h4>{t('daily_energy')}</h4>
          <div className="baselines-grid">
            {Object.entries(baselines.tdeeMultipliers).map(([level, cal]) => (
              <div key={level} className="baseline-item">
                <span className="baseline-value" style={{ fontSize: '0.95rem' }}>{cal}</span>
                <span className="baseline-label">{level.replace(/([A-Z])/g, ' $1')}</span>
              </div>
            ))}
          </div>

          {/* Strength baselines */}
          {baselines.strengthBaselines && (
            <>
              <h4>{t('strength_baselines')}</h4>
              <div className="baselines-grid">
                {Object.entries(baselines.strengthBaselines)
                  .filter(([k]) => k !== 'note')
                  .map(([name, kg]) => (
                    <div key={name} className="baseline-item">
                      <span className="baseline-value">{kg}kg</span>
                      <span className="baseline-label">{name.replace(/([A-Z])/g, ' $1')}</span>
                    </div>
                  ))}
              </div>
              <p className="text-xs text-muted">{baselines.strengthBaselines.note}</p>
            </>
          )}
        </div>
      )}

      {/* Medical records */}
      <div className="card">
        <h3>{t('medical_records')}</h3>
        <p className="text-xs text-muted" style={{ marginBottom: 10 }}>
          {t('upload_medical_desc')}
        </p>

        <div
          className="upload-zone"
          onClick={() => fileInputRef.current?.click()}
          style={{ marginBottom: 10 }}
        >
          <div className="upload-content">
            <div className="upload-icon">+</div>
            <p className="text-sm" style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{t('upload_file')}</p>
            <p className="text-xs text-muted">{t('pdf_images_docs')}</p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.pdf,.doc,.docx"
            onChange={handleFileUpload}
            style={{ display: 'none' }}
          />
        </div>

        {records.map(r => (
          <div key={r.id} className="record-item">
            <div className="record-header">
              <span style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.85rem' }}>{r.name}</span>
              <button
                className="btn btn-ghost btn-sm btn-danger"
                onClick={() => handleDeleteRecord(r.id)}
              >
                {t('delete')}
              </button>
            </div>
            {r.type?.startsWith('image/') && r.data && (
              <img src={r.data} alt={r.name} className="record-preview" />
            )}
            <span className="text-xs text-muted">
              {t('uploaded_on')} {new Date(r.uploadedAt).toLocaleDateString()}
            </span>
          </div>
        ))}

        {records.length === 0 && (
          <p className="text-sm text-muted">{t('no_records_yet')}</p>
        )}
      </div>

      {/* Data backup */}
      <div className="card">
        <h3>{lang === 'fr' ? 'Sauvegarde des données' : 'Data Backup'}</h3>
        <p className="text-xs text-muted" style={{ marginBottom: 12 }}>
          {lang === 'fr'
            ? 'Exportez vos données pour les sauvegarder ou les transférer vers un autre appareil.'
            : 'Export your data to back it up or transfer to another device.'}
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn btn-ghost"
            style={{ flex: 1 }}
            onClick={async () => {
              const data = {
                version: 1,
                exportedAt: new Date().toISOString(),
                profile: await getProfile(),
                workouts: await getAllWorkouts(),
              };
              const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `workoutvision-backup-${new Date().toISOString().slice(0, 10)}.json`;
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            {lang === 'fr' ? 'Exporter' : 'Export'}
          </button>
          <button
            className="btn btn-ghost"
            style={{ flex: 1 }}
            onClick={() => {
              const input = document.createElement('input');
              input.type = 'file';
              input.accept = '.json';
              input.onchange = async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                try {
                  const text = await file.text();
                  const data = JSON.parse(text);
                  if (!data.version || !data.profile) {
                    alert(lang === 'fr' ? 'Fichier invalide' : 'Invalid backup file');
                    return;
                  }
                  if (data.profile) await saveProfile(data.profile);
                  if (data.workouts) {
                    for (const w of data.workouts) await saveWorkout(w);
                  }
                  window.location.reload();
                } catch (err) {
                  alert(lang === 'fr' ? 'Erreur de lecture du fichier' : 'Failed to read backup file');
                }
              };
              input.click();
            }}
          >
            {lang === 'fr' ? 'Importer' : 'Import'}
          </button>
        </div>
      </div>

      {/* Device Capabilities Benchmark */}
      <div className="card">
        <h3>{lang === 'fr' ? 'Capacités de l\'appareil' : 'Device Capabilities'}</h3>
        <p className="text-xs text-muted" style={{ marginBottom: 12 }}>
          {lang === 'fr'
            ? 'Détectez les backends d\'accélération matérielle disponibles pour l\'inférence ML.'
            : 'Detect available hardware acceleration backends for ML inference.'}
        </p>
        <button
          className="btn btn-ghost"
          style={{ width: '100%', marginBottom: 12 }}
          disabled={benchmarkRunning}
          onClick={async () => {
            setBenchmarkRunning(true);
            try {
              const [caps, bench] = await Promise.all([
                detectCapabilities(),
                runMicroBenchmark(),
              ]);
              setBenchmarkResult({ ...caps, ...bench });
            } catch (err) {
              console.error('Benchmark failed:', err);
            } finally {
              setBenchmarkRunning(false);
            }
          }}
        >
          {benchmarkRunning
            ? (lang === 'fr' ? 'Analyse en cours...' : 'Running...')
            : (lang === 'fr' ? 'Lancer le benchmark' : 'Run Benchmark')}
        </button>

        {benchmarkResult && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
              <span style={{ color: 'var(--muted)' }}>WebGPU</span>
              <span style={{ fontWeight: 600, color: benchmarkResult.webgpu ? 'var(--green)' : 'var(--red)' }}>
                {benchmarkResult.webgpu ? (lang === 'fr' ? 'Oui' : 'Yes') : (lang === 'fr' ? 'Non' : 'No')}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
              <span style={{ color: 'var(--muted)' }}>WebNN</span>
              <span style={{ fontWeight: 600, color: benchmarkResult.webnn ? 'var(--green)' : 'var(--red)' }}>
                {benchmarkResult.webnn ? (lang === 'fr' ? 'Oui' : 'Yes') : (lang === 'fr' ? 'Non' : 'No')}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
              <span style={{ color: 'var(--muted)' }}>WebGL2</span>
              <span style={{ fontWeight: 600, color: benchmarkResult.webgl2 ? 'var(--green)' : 'var(--red)' }}>
                {benchmarkResult.webgl2 ? (lang === 'fr' ? 'Oui' : 'Yes') : (lang === 'fr' ? 'Non' : 'No')}
              </span>
            </div>
            {benchmarkResult.gpuAdapter && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                <span style={{ color: 'var(--muted)' }}>{lang === 'fr' ? 'Adaptateur GPU' : 'GPU Adapter'}</span>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                  {benchmarkResult.gpuAdapter.vendor}
                  {benchmarkResult.gpuAdapter.architecture !== 'unknown' ? ` (${benchmarkResult.gpuAdapter.architecture})` : ''}
                </span>
              </div>
            )}
            {benchmarkResult.webgl2Renderer && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                <span style={{ color: 'var(--muted)' }}>{lang === 'fr' ? 'Moteur WebGL2' : 'WebGL2 Renderer'}</span>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)', textAlign: 'right', maxWidth: '60%', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {benchmarkResult.webgl2Renderer}
                </span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
              <span style={{ color: 'var(--muted)' }}>{lang === 'fr' ? 'Backend recommandé' : 'Recommended Backend'}</span>
              <span style={{ fontWeight: 700, color: 'var(--primary)' }}>
                {benchmarkResult.recommendedBackend.toUpperCase()}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
              <span style={{ color: 'var(--muted)' }}>{lang === 'fr' ? 'CPU MatMul 256x256' : 'CPU MatMul 256x256'}</span>
              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                {benchmarkResult.matMulCpu} ms
              </span>
            </div>
          </div>
        )}
      </div>

      <p className="text-xs text-muted" style={{ textAlign: 'center', padding: '16px 0 32px', opacity: 0.5 }}>
        WorkoutVision v1.0.0
      </p>
    </div>
  );
}
