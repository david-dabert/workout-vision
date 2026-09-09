/**
 * Banner component for video suitability feedback.
 * Shows before/during analysis when video quality is questionable or poor.
 *
 * @param {Object} props
 * @param {Object} props.assessment - from VideoSuitabilityDetector.assess()
 * @param {boolean} [props.compact] - smaller variant for inline use
 */
export default function VideoSuitabilityBanner({ assessment, compact }) {
  if (!assessment) return null;

  const { suitable, issues } = assessment;

  if (suitable === 'good') {
    if (compact) return null;
    return (
      <div style={{
        padding: '8px 12px', borderRadius: 10,
        background: 'rgba(0,245,212,0.05)',
        border: '1px solid rgba(0,245,212,0.12)',
        display: 'flex', alignItems: 'center', gap: 8,
        fontSize: '0.75rem', color: 'var(--bio-cyan)',
        marginBottom: 10,
      }}>
        <span style={{ flexShrink: 0 }}>&#10003;</span>
        <span>Video looks suitable for analysis</span>
      </div>
    );
  }

  if (suitable === 'questionable') {
    return (
      <div style={{
        padding: compact ? '8px 12px' : '10px 14px', borderRadius: 10,
        background: 'rgba(255,184,54,0.08)',
        border: '1px solid rgba(255,184,54,0.2)',
        marginBottom: 10,
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          fontSize: '0.78rem', color: 'var(--yellow)', fontWeight: 600,
        }}>
          <span style={{ flexShrink: 0 }}>&#9888;&#65039;</span>
          <span>Some movement may be obscured. Results may vary.</span>
        </div>
        {!compact && issues && issues.length > 0 && (
          <div style={{ marginTop: 6, paddingLeft: 24 }}>
            {issues.map((issue, i) => (
              <div key={i} style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', padding: '1px 0', lineHeight: 1.4 }}>
                {issue}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // poor
  return (
    <div style={{
      padding: compact ? '8px 12px' : '10px 14px', borderRadius: 10,
      background: 'rgba(255,59,92,0.08)',
      border: '1px solid rgba(255,59,92,0.2)',
      marginBottom: 10,
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        fontSize: '0.78rem', color: 'var(--red)', fontWeight: 600,
      }}>
        <span style={{ flexShrink: 0 }}>&#10060;</span>
        <span>Video may not be suitable for analysis. Try filming from the side with full body visible.</span>
      </div>
      {!compact && issues && issues.length > 0 && (
        <div style={{ marginTop: 6, paddingLeft: 24 }}>
          {issues.map((issue, i) => (
            <div key={i} style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', padding: '1px 0', lineHeight: 1.4 }}>
              {issue}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
