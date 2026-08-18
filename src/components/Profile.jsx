import { useState, useEffect, useRef } from 'react';
import {
  getProfile, saveProfile, calculateBaselines,
  getMedicalRecords, saveMedicalRecord, deleteMedicalRecord,
} from '../lib/storage';

export default function Profile({ onClose }) {
  const [profile, setProfile] = useState({
    name: '', weight: '', height: '', age: '', sex: 'male', ethnicity: '', activityLevel: 'moderate',
  });
  const [baselines, setBaselines] = useState(null);
  const [saved, setSaved] = useState(false);
  const [records, setRecords] = useState([]);
  const fileInputRef = useRef(null);

  useEffect(() => {
    getProfile().then(p => {
      if (p) {
        setProfile(prev => ({ ...prev, ...p }));
        setBaselines(calculateBaselines(p));
      }
    });
    getMedicalRecords().then(setRecords);
  }, []);

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
