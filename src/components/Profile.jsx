import { useState, useEffect, useRef } from 'react';
import {
  calculateBaselines,
  getMedicalRecords, saveMedicalRecord, deleteMedicalRecord,
  getAllWorkouts, getProfile, saveWorkout,
} from '../lib/storage';
import { useProfile } from '../lib/ProfileContext';
import { useT } from '../lib/LanguageContext';
import { detectCapabilities, runMicroBenchmark } from '../lib/gpuBenchmark';
import DataPortability from './DataPortability';
import s from './Profile.module.css';

export default function Profile({ onClose }) {
  const { profile: savedProfile, saveProfile } = useProfile();
  const [profile, setProfile] = useState({
    name: '', weight: '', height: '', age: '', sex: 'male', ethnicity: '', activityLevel: 'moderate',
    restingHR: '', experience: 'intermediate', goal: 'general',
    injuries: [],
  });
  const [baselines, setBaselines] = useState(null);
  const [saved, setSaved] = useState(false);
  const [fileError, setFileError] = useState(null);
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
      setFileError(t('file_too_large'));
      e.target.value = '';
      return;
    }
    setFileError(null);

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
        <button className="btn-icon" onClick={onClose} aria-label={t('close')}>
          &#x2715;
        </button>
        <h2>{t('profile')}</h2>
      </div>

      {/* Profile form */}
      <div className="card">
        <div className="form-group">
          <label>{t('language')}</label>
          <div className={s.langSwitcher}>
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
            <div className={s.injuryTags}>
              {['lower_back', 'shoulder', 'knee', 'wrist', 'hip', 'ankle', 'neck', 'elbow'].map(area => {
                const active = (profile.injuries || []).includes(area);
                return (
                  <button
                    key={area}
                    type="button"
                    className={s.injuryTag}
                    onClick={() => {
                      const current = profile.injuries || [];
                      const next = current.includes(area)
                        ? current.filter(i => i !== area)
                        : [...current, area];
                      handleChange('injuries', next);
                    }}
                    style={{
                      borderColor: active ? 'var(--red)' : 'var(--border)',
                      background: active ? 'rgba(255,61,87,0.15)' : 'transparent',
                      color: active ? 'var(--red)' : 'var(--muted)',
                    }}
                  >
                    {area.replace('_', ' ')}
                  </button>
                );
              })}
            </div>
          </label>
        </div>
        {/* Training Days Picker */}
        <label className={`full-width ${s.trainingDaysLabel}`}>
          <span>{t('training_days')}</span>
          <p className={`text-xs text-muted ${s.trainingDaysDesc}`}>
            {t('training_days_desc')}
          </p>
          <div className={s.trainingDaysTags}>
            {[
              { day: 0, label: t('day_sun') },
              { day: 1, label: t('day_mon') },
              { day: 2, label: t('day_tue') },
              { day: 3, label: t('day_wed') },
              { day: 4, label: t('day_thu') },
              { day: 5, label: t('day_fri') },
              { day: 6, label: t('day_sat') },
            ].map(({ day, label }) => {
              const selected = (profile.trainingDays || [1, 3, 5]).includes(day);
              return (
                <button
                  key={day}
                  type="button"
                  className={s.trainingDayTag}
                  onClick={() => {
                    const current = profile.trainingDays || [1, 3, 5];
                    const next = selected
                      ? current.filter(d => d !== day)
                      : [...current, day].sort((a, b) => a - b);
                    handleChange('trainingDays', next);
                  }}
                  style={{
                    borderColor: selected ? 'var(--accent)' : 'var(--border)',
                    background: selected ? 'rgba(0,224,150,0.15)' : 'transparent',
                    color: selected ? 'var(--accent)' : 'var(--muted)',
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </label>

        <button className={`btn btn-primary ${s.saveBtn}`} onClick={handleSave}>
          {saved ? t('saved') : t('save_profile')}
        </button>
      </div>

      {/* Voice Coaching toggle */}
      <div className="card">
        <h3>{t('voice_coaching')}</h3>
        <p className={`text-xs text-muted ${s.sectionDesc}`}>
          {t('voice_coaching_desc')}
        </p>
        <label className={s.checkboxLabel}>
          <input
            type="checkbox"
            checked={profile.voiceCoachingEnabled !== false}
            onChange={(e) => handleChange('voiceCoachingEnabled', e.target.checked)}
            className={s.checkbox}
          />
          <span className={s.checkboxText}>
            {profile.voiceCoachingEnabled !== false
              ? t('voice_enabled')
              : t('voice_disabled')}
          </span>
        </label>
      </div>

      {/* Cycle Tracking (optional) */}
      <div className="card">
        <h3>{t('cycle_tracking')}</h3>
        <p className={`text-xs text-muted ${s.sectionDesc}`}>
          {t('cycle_tracking_desc')}
        </p>
        <label className={s.checkboxLabelSpaced}>
          <input
            type="checkbox"
            checked={!!profile.cycleTrackingEnabled}
            onChange={(e) => handleChange('cycleTrackingEnabled', e.target.checked)}
            className={s.checkbox}
          />
          <span className={s.checkboxText}>{t('enable_cycle_tracking')}</span>
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
                <div className={s.cyclePhaseBox} style={{ background: phaseColor }}>
                  <div className={s.cyclePhaseTitle}>
                    {t('cycle_current_phase')}: {t(phaseKey)}
                  </div>
                  <div className={s.cycleDayCount}>
                    {t('cycle_day')} {dayInCycle} / {cycleLen}
                  </div>
                  <div className={s.cycleTip}>
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
          {baselines && (
            <>
              <p className={`text-xs text-muted ${s.baselinesCaveat}`}>
                {t('baselines_caveat')}</p>
            </>
          )}
        </div>
      )}

      {/* Medical records */}
      <div className="card">
        <h3>{t('medical_records')}</h3>
        <p className={`text-xs text-muted ${s.sectionDesc}`}>
          {t('upload_medical_desc')}
        </p>

        <div
          className={`upload-zone ${s.uploadZone}`}
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="upload-content">
            <div className="upload-icon">+</div>
            <p className={`text-sm ${s.uploadLabel}`}>{t('upload_file')}</p>
            <p className="text-xs text-muted">{t('pdf_images_docs')}</p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.pdf,.doc,.docx"
            onChange={handleFileUpload}
            className={s.fileInputHidden}
          />
        </div>
        {fileError && (
          <div className="inline-error">
            <span>{fileError}</span>
            <button className="inline-error-dismiss" onClick={() => setFileError(null)} aria-label={t('close')}>&times;</button>
          </div>
        )}

        {records.map(r => (
          <div key={r.id} className="record-item">
            <div className="record-header">
              <span className={s.recordName}>{r.name}</span>
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

      {/* Data portability (export/import .wv files) */}
      <DataPortability />

      {/* Device Capabilities Benchmark */}
      <div className="card">
        <h3>{t('device_capabilities')}</h3>
        <p className={`text-xs text-muted ${s.benchmarkDesc}`}>
          {t('device_capabilities_desc')}
        </p>
        <button
          className={`btn btn-ghost ${s.benchmarkBtn}`}
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
            ? t('benchmark_running')
            : t('run_benchmark')}
        </button>

        {benchmarkResult && (
          <div className={s.benchmarkResults}>
            <div className={s.benchmarkRow}>
              <span className={s.benchmarkLabel}>WebGPU</span>
              <span style={{ fontWeight: 600, color: benchmarkResult.webgpu ? 'var(--green)' : 'var(--red)' }}>
                {benchmarkResult.webgpu ? t('yes') : t('no')}
              </span>
            </div>
            <div className={s.benchmarkRow}>
              <span className={s.benchmarkLabel}>WebNN</span>
              <span style={{ fontWeight: 600, color: benchmarkResult.webnn ? 'var(--green)' : 'var(--red)' }}>
                {benchmarkResult.webnn ? t('yes') : t('no')}
              </span>
            </div>
            <div className={s.benchmarkRow}>
              <span className={s.benchmarkLabel}>WebGL2</span>
              <span style={{ fontWeight: 600, color: benchmarkResult.webgl2 ? 'var(--green)' : 'var(--red)' }}>
                {benchmarkResult.webgl2 ? t('yes') : t('no')}
              </span>
            </div>
            {benchmarkResult.gpuAdapter && (
              <div className={s.benchmarkRow}>
                <span className={s.benchmarkLabel}>{t('gpu_adapter')}</span>
                <span className={s.benchmarkValue}>
                  {benchmarkResult.gpuAdapter.vendor}
                  {benchmarkResult.gpuAdapter.architecture !== 'unknown' ? ` (${benchmarkResult.gpuAdapter.architecture})` : ''}
                </span>
              </div>
            )}
            {benchmarkResult.webgl2Renderer && (
              <div className={s.benchmarkRow}>
                <span className={s.benchmarkLabel}>{t('webgl2_renderer')}</span>
                <span className={s.rendererValue}>
                  {benchmarkResult.webgl2Renderer}
                </span>
              </div>
            )}
            <div className={s.benchmarkRow}>
              <span className={s.benchmarkLabel}>{t('recommended_backend')}</span>
              <span className={s.benchmarkValueBold}>
                {benchmarkResult.recommendedBackend.toUpperCase()}
              </span>
            </div>
            <div className={s.benchmarkRow}>
              <span className={s.benchmarkLabel}>CPU MatMul 256x256</span>
              <span className={s.benchmarkValue}>
                {benchmarkResult.matMulCpu} ms
              </span>
            </div>
          </div>
        )}
      </div>

      <p className={`text-xs text-muted ${s.versionFooter}`}>
        WorkoutVision v1.0.0
      </p>
    </div>
  );
}
