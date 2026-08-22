import { useState, useEffect, useRef } from 'react';
import {
  calculateBaselines,
  getMedicalRecords, saveMedicalRecord, deleteMedicalRecord,
} from '../lib/storage';
import { useProfile } from '../lib/ProfileContext';
import { useT } from '../lib/LanguageContext';

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
            <p className="text-sm" style={{ color: '#fff', fontWeight: 600 }}>{t('upload_file')}</p>
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
              <span style={{ color: '#fff', fontWeight: 600, fontSize: '0.85rem' }}>{r.name}</span>
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
    </div>
  );
}
