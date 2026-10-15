import { useRef } from 'react';
import { hapticLight } from '../../lib/haptics';

// The row that picks a video, shared by the reference and physiotherapist screens.

export function FilePick({ label, hint, file, onFile, c, testId }) {
  const input = useRef(null);
  return <div className="rc-pick">
    <div className="rc-pick-txt">
      <b>{label}</b>
      <small>{file ? file.name : hint}</small>
    </div>
    <button type="button" className={`rc-btn press ${file ? '' : 'is-primary'}`} onClick={() => input.current?.click()} data-testid={testId}>{file ? c.change : c.choose}</button>
    <input ref={input} type="file" accept="video/*" hidden onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) { hapticLight(); onFile(f); } }} data-testid={`${testId}-input`} />
  </div>;
}


