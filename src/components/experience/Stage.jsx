import { useEffect, useRef } from 'react';
import { mountStage } from './stage-loop';

// Painted once, under every screen: dust, vignette, film grain.
export default function Stage() {
  const ref = useRef(null);
  useEffect(() => mountStage(ref.current), []);
  return <>
    <canvas ref={ref} className="wv-stage" aria-hidden="true" />
    <div className="wv-vignette" aria-hidden="true" />
    <div className="wv-grain" aria-hidden="true" />
  </>;
}
