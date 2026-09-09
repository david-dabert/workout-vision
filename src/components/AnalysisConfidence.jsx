import { useState } from 'react';

const STATUS_CONFIG = {
  high: {
    label: 'High confidence',
    color: 'var(--bio-cyan)',
    bg: 'rgba(0,245,212,0.12)',
    border: 'rgba(0,245,212,0.25)',
  },
  medium: {
    label: 'Moderate confidence',
    color: 'var(--yellow)',
    bg: 'rgba(255,184,54,0.1)',
    border: 'rgba(255,184,54,0.25)',
  },
  low: {
    label: 'Low confidence - results may be inaccurate',
    color: '#ff8c42',
    bg: 'rgba(255,140,66,0.1)',
    border: 'rgba(255,140,66,0.25)',
  },
  unreliable: {
    label: 'Unreliable - try a different video',
    color: 'var(--red)',
    bg: 'rgba(255,59,92,0.1)',
    border: 'rgba(255,59,92,0.25)',
  },
};

/**
 * Displays analysis confidence to the user with an expandable details panel.
 *
 * @param {Object} props
 * @param {Object} props.diagnostics - output of AnalysisDiagnostics.toJSON()
 * @param {Object} [props.viewpoint] - { angle, confidence } from cameraViewpoint
 */
export default function AnalysisConfidence({ diagnostics, viewpoint }) {
  const [expanded, setExpanded] = useState(false);

  if (!diagnostics || !diagnostics.analysis) return null;

  const status = diagnostics.analysis.status || 'unreliable';
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.unreliable;

  const poseRate = diagnostics.pose?.detectionRate;
  const movQ = diagnostics.movement?.signalQuality;
  const repMachine = diagnostics.reps?.machine ?? 0;
  const repUncertain = diagnostics.reps?.uncertain ?? 0;
  const warnings = diagnostics.analysis?.warnings || [];

  return (
    <div style={{ marginTop: 12 }}>
      {/* Badge */}
      <button
        onClick={() => setExpanded(v => !v)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '5px 14px', borderRadius: 9999,
          background: config.bg, border: `1px solid ${config.border}`,
          color: config.color, fontWeight: 700, fontSize: '0.75rem',
          cursor: 'pointer', fontFamily: 'var(--font)',
          letterSpacing: '0.02em',
        }}
      >
        <span style={{
          width: 7, height: 7, borderRadius: '50%',
          background: config.color, flexShrink: 0,
          boxShadow: `0 0 6px ${config.color}`,
        }} />
        {config.label}
        <span style={{
          marginLeft: 2, fontSize: '0.65rem', opacity: 0.7,
          transform: expanded ? 'rotate(180deg)' : 'rotate(0)',
          transition: 'transform 0.2s',
        }}>&#9660;</span>
      </button>

      {/* Expandable details */}
      {expanded && (
        <div style={{
          marginTop: 8, padding: '12px 14px',
          background: 'rgba(255,255,255,0.025)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 12, fontSize: '0.75rem',
          color: 'var(--text-secondary)', lineHeight: 1.6,
        }}>
          {poseRate != null && (
            <div>Pose detection rate: <strong style={{ color: 'var(--text-primary)' }}>{(poseRate * 100).toFixed(0)}%</strong></div>
          )}
          {movQ != null && (
            <div>Movement quality: <strong style={{ color: 'var(--text-primary)' }}>{(movQ * 100).toFixed(0)}%</strong></div>
          )}
          <div>
            Rep confidence: <strong style={{ color: 'var(--text-primary)' }}>{repMachine} confirmed</strong>
            {repUncertain > 0 && (
              <span style={{ color: 'var(--text-tertiary)', marginLeft: 4 }}>+ {repUncertain} uncertain</span>
            )}
          </div>
          {viewpoint && viewpoint.angle !== 'unknown' && (
            <div>Camera viewpoint: <strong style={{ color: 'var(--text-primary)' }}>{viewpoint.angle}</strong>
              <span style={{ color: 'var(--text-tertiary)', marginLeft: 4 }}>({(viewpoint.confidence * 100).toFixed(0)}%)</span>
            </div>
          )}
          {warnings.length > 0 && (
            <div style={{ marginTop: 8 }}>
              {warnings.map((w, i) => (
                <div key={i} style={{ color: 'var(--yellow)', fontSize: '0.7rem', padding: '2px 0' }}>
                  &#9888; {w}
                </div>
              ))}
            </div>
          )}
          {diagnostics.analysis.failureReasons?.length > 0 && (
            <div style={{ marginTop: 4 }}>
              {diagnostics.analysis.failureReasons.map((r, i) => (
                <div key={i} style={{ color: 'var(--red)', fontSize: '0.7rem', padding: '2px 0' }}>
                  &#10060; {r}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
