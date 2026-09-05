import { useState, useEffect } from 'react';
import { assessInjuryRisk } from '../lib/injuryRisk';
import { useT } from '../lib/LanguageContext';

const RISK_COLORS = {
  low: 'var(--accent, #00f5d4)',
  moderate: 'var(--yellow, #ffb836)',
  high: 'var(--red, #ff3b5c)',
};

const RISK_ICONS = {
  low: '✓',
  moderate: '⚠',
  high: '⚡',
};

export default function InjuryRiskCard() {
  const { lang } = useT();
  const [report, setReport] = useState(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    assessInjuryRisk().then(setReport);
  }, []);

  if (!report || report.message === 'not_enough_data') return null;
  if (report.flags.length === 0 && report.overall === 'low') return null;

  const riskLabel = {
    low: { en: 'Low Risk', fr: 'Risque faible' },
    moderate: { en: 'Moderate Risk', fr: 'Risque modéré' },
    high: { en: 'Elevated Risk', fr: 'Risque élevé' },
  };

  return (
    <div className="card insights-card" style={{
      borderColor: report.overall !== 'low' ? RISK_COLORS[report.overall] : undefined,
      borderWidth: report.overall !== 'low' ? 1 : undefined,
    }}>
      <div
        onClick={() => setExpanded(!expanded)}
        style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}
      >
        <span style={{
          fontSize: '1.4rem',
          width: 36, height: 36,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          borderRadius: '50%',
          background: `${RISK_COLORS[report.overall]}15`,
          color: RISK_COLORS[report.overall],
        }}>
          {RISK_ICONS[report.overall]}
        </span>
        <div style={{ flex: 1 }}>
          <h4 className="insights-card-title" style={{ margin: 0 }}>
            {lang === 'fr' ? 'Prédiction de risque' : 'Injury Risk'}
          </h4>
          <span style={{
            fontSize: '0.78rem',
            color: RISK_COLORS[report.overall],
            fontWeight: 600,
          }}>
            {riskLabel[report.overall][lang]}
            {report.acwr && ` · ACWR ${report.acwr}`}
          </span>
        </div>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke="var(--text-secondary)" strokeWidth="2" strokeLinecap="round"
          style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>

      {expanded && (
        <div style={{ marginTop: 14 }}>
          {report.flags.map((flag, i) => (
            <div key={i} style={{
              padding: '10px 12px',
              marginBottom: 8,
              borderRadius: 10,
              background: `${RISK_COLORS[flag.risk]}08`,
              border: `1px solid ${RISK_COLORS[flag.risk]}20`,
              fontSize: '0.82rem',
              color: 'var(--text-secondary)',
              lineHeight: 1.5,
            }}>
              <span style={{ color: RISK_COLORS[flag.risk], fontWeight: 600 }}>
                {RISK_ICONS[flag.risk]}{' '}
              </span>
              {flag[lang] || flag.en}
            </div>
          ))}

          {report.recommendations.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <span style={{
                fontSize: '0.72rem',
                color: 'var(--text-tertiary)',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                fontWeight: 600,
              }}>
                {lang === 'fr' ? 'Recommandations' : 'Recommendations'}
              </span>
              {report.recommendations.map((rec, i) => (
                <p key={i} style={{
                  fontSize: '0.82rem',
                  color: 'var(--text-secondary)',
                  margin: '6px 0',
                  lineHeight: 1.5,
                }}>
                  {rec[lang] || rec.en}
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
