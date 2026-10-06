import { useEffect, useRef } from 'react';
import { DEMOS } from './about-copy';

// Real sets as the app saw them: each the app's own replay exported by David (DEMOS, about-copy.js), muted and
// looping, with the two counts under it. Shown on the About page and under the entry's drawn example.
// Five videos stacked: each plays only while on screen, so the phone decodes one or two at a time.
export function DemoVideo({ d, fr }) {
  const base = `${import.meta.env.BASE_URL}demo/${d.file}`;
  const ref = useRef(null);
  useEffect(() => {
    const v = ref.current;
    if (!v || typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) v.play()?.catch?.(() => {}); else v.pause(); }, { threshold: 0.25 });
    io.observe(v);
    return () => io.disconnect();
  }, []);
  return <figure className="about-photo about-demo">
    <video ref={ref} src={`${base}.mp4`} poster={`${base}.jpg`} width={d.width} height={d.height} muted loop playsInline autoPlay preload="metadata" aria-label={fr ? d.fr : d.en} />
    <figcaption>{fr ? d.fr : d.en}</figcaption>
  </figure>;
}

export const DemoVideos = ({ fr }) => DEMOS.map(d => <DemoVideo key={d.file} d={d} fr={fr} />);
