import { useState, useEffect, useRef } from 'react';
import { saveMedicalRecord, getMedicalRecords, deleteMedicalRecord } from '../lib/storage';

const HEALTH_MARKERS = [
  'Resting heart rate',
  'Blood pressure (systolic/diastolic)',
  'HbA1c',
  'Testosterone',
  'Vitamin D',
  'Iron / Ferritin',
  'CRP (inflammation)',
  'Lipid panel (LDL, HDL, triglycerides)',
  'Injury history / notes',
];

export default function MedicalRecords({ onClose }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    loadRecords();
  }, []);

  async function loadRecords() {
    setLoading(true);
    try {
      const all = await getMedicalRecords();
      setRecords(all);
    } catch (err) {
      console.error('Failed to load records:', err);
    }
    setLoading(false);
  }

  async function handleUpload(e) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setUploading(true);

    for (const file of files) {
      const isImage = file.type.startsWith('image/');
      const isPdf = file.type === 'application/pdf';
      if (!isImage && !isPdf) continue;

      let preview = null;
      if (isImage) {
        preview = await readFileAsDataUrl(file);
      }

      const record = {
        id: Date.now().toString() + Math.random().toString(36).slice(2, 6),
        date: new Date().toISOString(),
        fileName: file.name,
        fileType: file.type,
        fileSize: (file.size / 1024 / 1024).toFixed(2) + ' MB',
        preview,
        notes: '',
      };

      try {
        await saveMedicalRecord(record);
        setRecords(prev => [record, ...prev]);
      } catch (err) {
        console.error('Failed to save record:', err);
      }
    }

    setUploading(false);
    e.target.value = '';
  }

  async function handleDelete(id) {
    try {
      await deleteMedicalRecord(id);
      setRecords(prev => prev.filter(r => r.id !== id));
    } catch (err) {
      console.error('Failed to delete record:', err);
    }
  }

  function handleNotesChange(id, notes) {
    setRecords(prev => prev.map(r => {
      if (r.id !== id) return r;
      const updated = { ...r, notes };
      saveMedicalRecord(updated).catch(err => console.error('Save notes error:', err));
      return updated;
    }));
  }

  if (loading) {
    return (
      <div className="page">
        <div className="page-header">
          <h2>Medical Records</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Close</button>
        </div>
        <div style={{ textAlign: 'center', padding: 40 }}>
          <div className="spinner" />
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <h2>Medical Records</h2>
        <button className="btn btn-ghost btn-sm" onClick={onClose}>Close</button>
      </div>

      {/* Upload zone */}
      <div className="upload-zone" onClick={() => fileInputRef.current?.click()}>
        <div className="upload-content">
          <div className="upload-icon">+</div>
          <p className="text-sm" style={{ color: '#fff', fontWeight: 600 }}>
            {uploading ? 'Uploading...' : 'Upload medical records'}
          </p>
          <p className="text-xs text-muted">PDF, JPG, PNG</p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,application/pdf"
          multiple
          onChange={handleUpload}
          style={{ display: 'none' }}
        />
      </div>

      {/* Health markers checklist */}
      <div className="card" style={{ marginTop: 10 }}>
        <h3>Key health markers to track</h3>
        <ul className="health-markers">
          {HEALTH_MARKERS.map((marker, i) => (
            <li key={i}>{marker}</li>
          ))}
        </ul>
      </div>

      {/* Uploaded records */}
      {records.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <h4>Uploaded records</h4>
          {records.map(r => (
            <div key={r.id} className="record-item">
              <div className="record-header">
                <div>
                  <strong style={{ color: '#fff', fontSize: '0.85rem' }}>{r.fileName}</strong>
                  <span className="text-xs text-muted" style={{ marginLeft: 6 }}>
                    {r.fileSize}
                  </span>
                </div>
                <button
                  className="btn btn-ghost btn-sm btn-danger"
                  onClick={() => handleDelete(r.id)}
                >
                  Delete
                </button>
              </div>

              {r.preview && (
                <img
                  src={r.preview}
                  alt={r.fileName}
                  className="record-preview"
                />
              )}

              {r.fileType === 'application/pdf' && (
                <div style={{
                  background: 'var(--bg)',
                  borderRadius: 'var(--radius-sm)',
                  padding: 14,
                  textAlign: 'center',
                  marginBottom: 6,
                }}>
                  <span className="text-sm text-muted">PDF document</span>
                </div>
              )}

              <textarea
                className="record-notes"
                value={r.notes}
                onChange={(e) => handleNotesChange(r.id, e.target.value)}
                placeholder="Add notes about this record..."
                rows={2}
              />

              <span className="text-xs text-muted" style={{ marginTop: 4, display: 'block' }}>
                Uploaded {new Date(r.date).toLocaleDateString('en-GB', {
                  day: 'numeric', month: 'short', year: 'numeric'
                })}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function readFileAsDataUrl(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}
