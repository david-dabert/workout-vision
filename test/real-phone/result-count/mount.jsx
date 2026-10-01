// The real result screen (src/components/experience/Result.jsx) mounted alone, on a known result of 7
// reps, for check.mjs. Served by the Vite dev server; nothing here is built into the app.
import { createRoot } from 'react-dom/client';
import { LanguageProvider } from '../../../src/lib/LanguageContext';
import Result from '../../../src/components/experience/Result';

const reps = Array.from({ length: 7 }, (_, i) => ({
  index: i + 1, startTime: 1 + i * 3, endTime: 3.5 + i * 3, romDegrees: 100 - i * 3,
  concentricSec: 1 + i * 0.1, eccentricSec: 1.3, peakSpeed: 110, meanSpeed: 70, clipped: i === 6,
}));
const result = { count: 7, refused: false, arm: 'right', confidence: 0.9, reps, metadata: { duration: 23, method: 'fixture' }, timestamps: [], imageLandmarks: [], worldLandmarks: [] };
const noop = () => {};
createRoot(document.getElementById('root')).render(
  <LanguageProvider>
    <Result result={result} lift="bicep_curl" covered="" onClose={noop} onReport={noop} onReplay={noop} onNewSet={noop} onRefilm={noop} />
  </LanguageProvider>,
);
