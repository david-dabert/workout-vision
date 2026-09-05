import { useState, useRef } from 'react';
import { useT } from '../lib/LanguageContext';
import { useProfile } from '../lib/ProfileContext';
import {
  exportAllData,
  downloadBlob,
  readImportFile,
  importData,
} from '../lib/dataPortability';

export default function DataPortability() {
  const { t, lang } = useT();
  const { saveProfile } = useProfile();
  const fileRef = useRef(null);

  const [exporting, setExporting] = useState(false);
  const [exportDone, setExportDone] = useState(false);

  const [importStage, setImportStage] = useState('idle'); // idle | preview | importing | done | error
  const [importSummary, setImportSummary] = useState(null);
  const [importData_, setImportData] = useState(null);
  const [importMode, setImportMode] = useState('merge');
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
  const [importResult, setImportResult] = useState(null);
  const [importError, setImportError] = useState('');

  const handleExport = async () => {
    setExporting(true);
    setExportDone(false);
    try {
      const { blob } = await exportAllData();
      downloadBlob(blob);
      setExportDone(true);
      setTimeout(() => setExportDone(false), 3000);
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setExporting(false);
    }
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    try {
      const { data, summary } = await readImportFile(file);
      setImportSummary(summary);
      setImportData(data);
      setImportStage('preview');
      setImportError('');
    } catch (err) {
      setImportError(
        err.message === 'INVALID_FORMAT'
          ? t('dp_invalid_file')
          : err.message === 'MISSING_VERSION'
          ? t('dp_missing_version')
          : t('dp_read_error')
      );
      setImportStage('error');
    }
  };

  const handleImport = async () => {
    if (!importData_) return;
    setImportStage('importing');
    setImportProgress({ current: 0, total: 5 });

    try {
      await importData(importData_, importMode, (current, total) => {
        setImportProgress({ current, total });
      });

      // If profile was imported, refresh the context
      if (importData_.profile) {
        await saveProfile(importData_.profile);
      }

      setImportResult(importSummary);
      setImportStage('done');
    } catch (err) {
      console.error('Import failed:', err);
      setImportError(t('dp_import_error'));
      setImportStage('error');
    }
  };

  const resetImport = () => {
    setImportStage('idle');
    setImportSummary(null);
    setImportData(null);
    setImportResult(null);
    setImportError('');
  };

  const summaryLine = (summary) => {
    if (!summary) return '';
    const parts = [];
    if (summary.profile) parts.push(`1 ${t('dp_profile')}`);
    if (summary.workouts) parts.push(`${summary.workouts} ${t('dp_workouts')}`);
    if (summary.food) parts.push(`${summary.food} ${t('dp_food_entries')}`);
    if (summary.medical) parts.push(`${summary.medical} ${t('dp_medical_records')}`);
    if (summary.milestones) parts.push(`${summary.milestones} ${t('dp_milestones')}`);
    return parts.join(', ');
  };

  return (
    <div className="card">
      <h3>{t('dp_title')}</h3>
      <p className="text-xs text-muted" style={{ marginBottom: 12 }}>
        {t('dp_description')}
      </p>

      {/* Export button */}
      <button
        className="btn btn-ghost"
        style={{ width: '100%', marginBottom: 8 }}
        onClick={handleExport}
        disabled={exporting}
      >
        {exporting
          ? t('dp_exporting')
          : exportDone
          ? t('dp_exported')
          : t('dp_export_btn')}
      </button>

      {/* Import button */}
      <button
        className="btn btn-ghost"
        style={{ width: '100%', marginBottom: 12 }}
        onClick={() => fileRef.current?.click()}
        disabled={importStage === 'importing'}
      >
        {t('dp_import_btn')}
      </button>
      <input
        ref={fileRef}
        type="file"
        accept=".wv,.json"
        onChange={handleFileSelect}
        style={{ display: 'none' }}
      />

      {/* Preview before import */}
      {importStage === 'preview' && importSummary && (
        <div style={{
          padding: '12px 14px',
          borderRadius: 10,
          background: 'rgba(0, 245, 212, 0.08)',
          border: '1px solid var(--border)',
          marginBottom: 12,
        }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: 8, color: 'var(--text-primary)' }}>
            {t('dp_preview_title')}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--muted)', marginBottom: 8 }}>
            {summaryLine(importSummary)}
          </div>
          {importSummary.exportedAt && (
            <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginBottom: 10 }}>
              {t('dp_exported_on')} {new Date(importSummary.exportedAt).toLocaleDateString()}
            </div>
          )}

          {/* Merge vs Replace */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <button
              className={`btn btn-sm ${importMode === 'merge' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setImportMode('merge')}
            >
              {t('dp_merge')}
            </button>
            <button
              className={`btn btn-sm ${importMode === 'replace' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setImportMode('replace')}
              style={importMode === 'replace' ? { background: 'var(--red)', borderColor: 'var(--red)' } : {}}
            >
              {t('dp_replace')}
            </button>
          </div>

          {importMode === 'replace' && (
            <p className="text-xs" style={{ color: 'var(--red)', marginBottom: 10 }}>
              {t('dp_replace_warning')}
            </p>
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary btn-sm" style={{ flex: 1 }} onClick={handleImport}>
              {t('dp_confirm_import')}
            </button>
            <button className="btn btn-ghost btn-sm" style={{ flex: 1 }} onClick={resetImport}>
              {t('cancel')}
            </button>
          </div>
        </div>
      )}

      {/* Progress */}
      {importStage === 'importing' && (
        <div style={{
          padding: '12px 14px',
          borderRadius: 10,
          background: 'rgba(0, 245, 212, 0.08)',
          border: '1px solid var(--border)',
          marginBottom: 12,
        }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>
            {t('dp_importing')}
          </div>
          <div style={{
            height: 6,
            borderRadius: 3,
            background: 'var(--border)',
            overflow: 'hidden',
          }}>
            <div style={{
              height: '100%',
              width: importProgress.total > 0
                ? `${(importProgress.current / importProgress.total) * 100}%`
                : '0%',
              background: 'var(--primary)',
              borderRadius: 3,
              transition: 'width 0.3s ease',
            }} />
          </div>
        </div>
      )}

      {/* Done */}
      {importStage === 'done' && importResult && (
        <div style={{
          padding: '12px 14px',
          borderRadius: 10,
          background: 'rgba(76, 175, 80, 0.12)',
          border: '1px solid rgba(76, 175, 80, 0.3)',
          marginBottom: 12,
        }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--green)', marginBottom: 6 }}>
            {t('dp_import_success')}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
            {summaryLine(importResult)}
          </div>
          <button className="btn btn-ghost btn-sm" style={{ marginTop: 10 }} onClick={resetImport}>
            {t('done')}
          </button>
        </div>
      )}

      {/* Error */}
      {importStage === 'error' && (
        <div style={{
          padding: '12px 14px',
          borderRadius: 10,
          background: 'rgba(255, 61, 87, 0.12)',
          border: '1px solid rgba(255, 61, 87, 0.3)',
          marginBottom: 12,
        }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--red)' }}>
            {importError || t('dp_import_error')}
          </div>
          <button className="btn btn-ghost btn-sm" style={{ marginTop: 10 }} onClick={resetImport}>
            {t('retry')}
          </button>
        </div>
      )}
    </div>
  );
}
