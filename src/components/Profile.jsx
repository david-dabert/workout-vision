import { useState, useEffect, useRef } from 'react';
import {
  calculateBaselines,
  getMedicalRecords, saveMedicalRecord, deleteMedicalRecord,
} from '../lib/storage';
import { useProfile } from '../lib/ProfileContext';

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
      alert('File too large. Maximum size is 10MB.');
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
        <h2>Profile</h2>
      </div>

      {/* Profile form */}
      <div className="card">
        <h3>Your measurements</h3>
        <div className="form-grid">
          <label>
            <span>Name</span>
            <input
              type="text"
              value={profile.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="Your name"
            />
          </label>
          <label>
            <span>Age</span>
            <input
              type="number"
              value={profile.age}
              onChange={(e) => handleChange('age', e.target.value)}
              placeholder="Years"
            />
          </label>
          <label>
            <span>Weight (kg)</span>
            <input
              type="number"
              value={profile.weight}
              onChange={(e) => handleChange('weight', e.target.value)}
              placeholder="kg"
            />
          </label>
          <label>
            <span>Height (cm)</span>
            <input
              type="number"
              value={profile.height}
              onChange={(e) => handleChange('height', e.target.value)}
              placeholder="cm"
            />
          </label>
          <label>
            <span>Sex</span>
            <select value={profile.sex} onChange={(e) => handleChange('sex', e.target.value)}>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </label>
          <label>
            <span>Ethnicity</span>
            <input
              type="text"
              value={profile.ethnicity}
              onChange={(e) => handleChange('ethnicity', e.target.value)}
              placeholder="Optional"
            />
          </label>
          <label className="full-width">
            <span>Activity Level</span>
            <select value={profile.activityLevel} onChange={(e) => handleChange('activityLevel', e.target.value)}>
              <option value="sedentary">Sedentary</option>
              <option value="light">Light (1-2x/week)</option>
              <option value="moderate">Moderate (3-4x/week)</option>
              <option value="active">Active (5-6x/week)</option>
              <option value="veryActive">Very Active (daily)</option>
            </select>
          </label>
          <label>
            <span>Resting HR (bpm)</span>
            <input
              type="number"
              value={profile.restingHR}
              onChange={(e) => handleChange('restingHR', e.target.value)}
              placeholder="e.g. 65"
            />
          </label>
          <label>
            <span>Experience</span>
            <select value={profile.experience} onChange={(e) => handleChange('experience', e.target.value)}>
              <option value="beginner">Beginner (&lt;1 year)</option>
              <option value="intermediate">Intermediate (1-3 years)</option>
              <option value="advanced">Advanced (3+ years)</option>
            </select>
          </label>
          <label>
            <span>Goal</span>
            <select value={profile.goal} onChange={(e) => handleChange('goal', e.target.value)}>
              <option value="general">General Fitness</option>
              <option value="strength">Strength</option>
              <option value="hypertrophy">Muscle Growth</option>
              <option value="endurance">Endurance</option>
              <option value="weight_loss">Weight Loss</option>
            </select>
          </label>
          <label className="full-width">
            <span>Injuries / limitations</span>
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
          {saved ? 'Saved!' : 'Save Profile'}
        </button>
      </div>

      {/* Baselines */}
      {baselines && (
        <div className="card">
          <h3>Your baselines</h3>
          <div className="baselines-grid">
            <div className="baseline-item">
              <span className="baseline-value">{baselines.bmi}</span>
              <span className="baseline-label">BMI</span>
            </div>
            <div className="baseline-item">
              <span className="baseline-value">{baselines.bmr}</span>
              <span className="baseline-label">BMR</span>
            </div>
            <div className="baseline-item">
              <span className="baseline-value">{baselines.estimatedBF}%</span>
              <span className="baseline-label">Est. BF</span>
            </div>
            <div className="baseline-item">
              <span className="baseline-value">{baselines.maxHR}</span>
              <span className="baseline-label">Max HR</span>
            </div>
          </div>

          {/* Heart rate zones */}
          <h4>Heart rate zones</h4>
          <div className="zones">
            {Object.entries(baselines.zones).map(([name, range]) => (
              <div key={name} className={`zone zone-${name}`}>
                <span className="zone-name">{name.replace(/([A-Z])/g, ' $1')}</span>
                <span className="zone-range">{range.min} - {range.max} bpm</span>
              </div>
            ))}
          </div>

          {/* TDEE */}
          <h4>Daily energy needs</h4>
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
              <h4>Strength baselines (untrained est.)</h4>
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
        <h3>Medical records</h3>
        <p className="text-xs text-muted" style={{ marginBottom: 10 }}>
          Upload medical files. Everything stays on your device.
        </p>

        <div
          className="upload-zone"
          onClick={() => fileInputRef.current?.click()}
          style={{ marginBottom: 10 }}
        >
          <div className="upload-content">
            <div className="upload-icon">+</div>
            <p className="text-sm" style={{ color: '#fff', fontWeight: 600 }}>Upload file</p>
            <p className="text-xs text-muted">PDF, images, documents</p>
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
                Delete
              </button>
            </div>
            {r.type?.startsWith('image/') && r.data && (
              <img src={r.data} alt={r.name} className="record-preview" />
            )}
            <span className="text-xs text-muted">
              Uploaded {new Date(r.uploadedAt).toLocaleDateString()}
            </span>
          </div>
        ))}

        {records.length === 0 && (
          <p className="text-sm text-muted">No records uploaded yet.</p>
        )}
      </div>
    </div>
  );
}
