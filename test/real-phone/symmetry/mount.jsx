// The real result screen (Result.jsx) on one of David's labelled sets, counted by the core, for check.mjs.
// The set's landmarks come from /set.json, which check.mjs serves. Nothing here is built into the app.
import { createRoot } from 'react-dom/client';
import { LanguageProvider } from '../../../src/lib/LanguageContext';
import Result from '../../../src/components/experience/Result';
import { summarizeCount } from '../../../src/lib/coreAnalysis';

const set = await (await fetch('/set.json')).json();
const result = { ...summarizeCount(set.worldLandmarks, set.timestamps, set.lift), metadata: { duration: set.timestamps.at(-1), method: 'fixture' }, imageLandmarks: [], worldLandmarks: set.worldLandmarks, timestamps: set.timestamps };
const noop = () => {};
createRoot(document.getElementById('root')).render(
  <LanguageProvider>
    <Result result={result} lift={set.lift} covered="" onClose={noop} onReport={noop} onReplay={noop} onNewSet={noop} onRefilm={noop} />
  </LanguageProvider>,
);
