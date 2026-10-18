// The animated figure of a guide exercise (guide-figure.js): a drawing, never a measurement.
import { useEffect, useRef } from 'react';
import { createPoseScene } from './lift-scenes';
import { figureHash, loadGuideFigure } from './guide-figure';

/** The exercise's animated figure on a canvas filling its parent; it stops drawing while scrolled out of view. */
export function GuideFigure({ exercise }) {
  const canvas = useRef(null);
  useEffect(() => {
    let dispose = null, gone = false, io = null;
    loadGuideFigure(exercise).then(data => {
      if (gone || !data || !canvas.current) return;
      const h = figureHash(exercise);
      dispose = createPoseScene(canvas.current, data, 'loop', { seed: 200 + (h % 997), phase: h % data.loop.f.length });
      if (typeof IntersectionObserver !== 'undefined') {
        io = new IntersectionObserver(entries => dispose?.setRunning(entries[entries.length - 1].isIntersecting));
        io.observe(canvas.current);
      }
    });
    return () => { gone = true; io?.disconnect(); dispose?.(); };
  }, [exercise]);
  return <canvas ref={canvas} className="guide-figure" data-testid="guide-figure" aria-hidden="true" />;
}
