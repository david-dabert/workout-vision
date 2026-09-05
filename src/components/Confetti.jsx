import { useEffect, useRef } from 'react';

const COLORS = ['#00f5d4', '#00e676', '#ffb836', '#ff6b9d', '#a855f7'];
const PARTICLE_COUNT = 60;
const DURATION = 2000;
const GRAVITY = 0.003;

function randomBetween(a, b) {
  return a + Math.random() * (b - a);
}

export default function Confetti({ active }) {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);

  useEffect(() => {
    if (!active) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;

    // Create particles
    const particles = Array.from({ length: PARTICLE_COUNT }, () => ({
      x: w / 2 + randomBetween(-w * 0.3, w * 0.3),
      y: h * 0.3,
      vx: randomBetween(-4, 4),
      vy: randomBetween(-8, -2),
      size: randomBetween(4, 8),
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      rotation: randomBetween(0, Math.PI * 2),
      rotationSpeed: randomBetween(-0.1, 0.1),
      shape: Math.random() > 0.5 ? 'rect' : 'circle',
      opacity: 1,
    }));

    const startTime = performance.now();

    function frame(now) {
      const elapsed = now - startTime;
      if (elapsed > DURATION) {
        ctx.clearRect(0, 0, w, h);
        return;
      }

      const progress = elapsed / DURATION;
      ctx.clearRect(0, 0, w, h);

      for (const p of particles) {
        p.vy += GRAVITY * 16; // gravity per frame approx
        p.x += p.vx;
        p.y += p.vy;
        p.rotation += p.rotationSpeed;

        // Fade out in the last 40% of duration
        p.opacity = progress > 0.6 ? 1 - (progress - 0.6) / 0.4 : 1;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.globalAlpha = Math.max(0, p.opacity);
        ctx.fillStyle = p.color;

        if (p.shape === 'rect') {
          ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        } else {
          ctx.beginPath();
          ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.restore();
      }

      rafRef.current = requestAnimationFrame(frame);
    }

    rafRef.current = requestAnimationFrame(frame);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [active]);

  if (!active) return null;

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 10,
      }}
    />
  );
}
