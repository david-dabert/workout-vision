import { DEMOS } from './about-copy';

// Real sets as the app saw them: each the app's own replay exported by David (DEMOS, about-copy.js), muted and
// looping, with the two counts under it. Shown on the About page and under the entry's drawn example.
export function DemoVideo({ d, fr }) {
  const base = `${import.meta.env.BASE_URL}demo/${d.file}`;
  return <figure className="about-photo about-demo">
    <video src={`${base}.mp4`} poster={`${base}.jpg`} width={d.width} height={d.height} muted loop playsInline autoPlay preload="metadata" aria-label={fr ? d.fr : d.en} />
    <figcaption>{fr ? d.fr : d.en}</figcaption>
  </figure>;
}

export const DemoVideos = ({ fr }) => DEMOS.map(d => <DemoVideo key={d.file} d={d} fr={fr} />);
