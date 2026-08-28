import { useEffect, useRef } from 'react';

const JOINTS = [
  { id: 'head', x: 0.50, y: 0.15, size: 4 },
  { id: 'neck', x: 0.50, y: 0.22, size: 2.5 },
  { id: 'lShoulder', x: 0.35, y: 0.28, size: 2.5 },
  { id: 'rShoulder', x: 0.65, y: 0.28, size: 2.5 },
  { id: 'lElbow', x: 0.22, y: 0.40, size: 2 },
  { id: 'rElbow', x: 0.78, y: 0.40, size: 2 },
  { id: 'lWrist', x: 0.12, y: 0.52, size: 2 },
  { id: 'rWrist', x: 0.88, y: 0.52, size: 2 },
  { id: 'spine', x: 0.50, y: 0.42, size: 2.5 },
  { id: 'lHip', x: 0.42, y: 0.50, size: 2.5 },
  { id: 'rHip', x: 0.58, y: 0.50, size: 2.5 },
  { id: 'lKnee', x: 0.38, y: 0.68, size: 2.5 },
  { id: 'rKnee', x: 0.62, y: 0.68, size: 2.5 },
  { id: 'lAnkle', x: 0.35, y: 0.88, size: 2 },
  { id: 'rAnkle', x: 0.65, y: 0.88, size: 2 },
];

const CONNECTIONS = [
  ['head', 'neck'], ['neck', 'lShoulder'], ['neck', 'rShoulder'],
  ['lShoulder', 'lElbow'], ['rShoulder', 'rElbow'],
  ['lElbow', 'lWrist'], ['rElbow', 'rWrist'],
  ['neck', 'spine'], ['spine', 'lHip'], ['spine', 'rHip'],
  ['lHip', 'lKnee'], ['rHip', 'rKnee'],
  ['lKnee', 'lAnkle'], ['rKnee', 'rAnkle'],
  ['lHip', 'rHip'], ['lShoulder', 'rShoulder'],
];

export default function ParticleSkeleton({ onRep, className = '' }) {
  const canvasRef = useRef(null);
  const stateRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animId;
    let time = 0;

    const resize = () => {
      const rect = canvas.parentElement.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
      return { w: rect.width, h: rect.height };
    };

    let { w, h } = resize();

    const particles = JOINTS.map(j => ({
      ...j,
      px: j.x, py: j.y,
      vx: 0, vy: 0,
      phase: Math.random() * Math.PI * 2,
      pulsePhase: Math.random() * Math.PI * 2,
    }));

    const pulses = [];

    const triggerPulse = (fromId, toId) => {
      pulses.push({ from: fromId, to: toId, progress: 0, speed: 0.04 });
    };

    stateRef.current = { triggerPulse };

    const draw = () => {
      time += 0.016;
      ctx.clearRect(0, 0, w, h);

      // Idle drift
      particles.forEach(p => {
        const nx = Math.sin(time * 0.8 + p.phase) * 0.008;
        const ny = Math.cos(time * 0.6 + p.phase * 1.3) * 0.008;
        p.px += (p.x + nx - p.px) * 0.05;
        p.py += (p.y + ny - p.py) * 0.05;
      });

      // Connections
      CONNECTIONS.forEach(([aId, bId]) => {
        const a = particles.find(p => p.id === aId);
        const b = particles.find(p => p.id === bId);
        if (!a || !b) return;
        const ax = a.px * w, ay = a.py * h;
        const bx = b.px * w, by = b.py * h;
        const dist = Math.hypot(bx - ax, by - ay);
        const alpha = Math.max(0, 1 - dist / (w * 0.35)) * 0.22;

        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(bx, by);
        ctx.strokeStyle = `rgba(0, 245, 212, ${alpha})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      });

      // Pulses (traveling light along connections)
      for (let i = pulses.length - 1; i >= 0; i--) {
        const pulse = pulses[i];
        pulse.progress += pulse.speed;
        if (pulse.progress >= 1) { pulses.splice(i, 1); continue; }

        const a = particles.find(p => p.id === pulse.from);
        const b = particles.find(p => p.id === pulse.to);
        if (!a || !b) continue;

        const ax = a.px * w, ay = a.py * h;
        const bx = b.px * w, by = b.py * h;
        const px = ax + (bx - ax) * pulse.progress;
        const py = ay + (by - ay) * pulse.progress;

        const glow = ctx.createRadialGradient(px, py, 0, px, py, 20);
        glow.addColorStop(0, `rgba(0, 245, 212, ${0.8 * (1 - pulse.progress)})`);
        glow.addColorStop(1, 'rgba(0, 245, 212, 0)');
        ctx.fillStyle = glow;
        ctx.fillRect(px - 20, py - 20, 40, 40);

        ctx.beginPath();
        ctx.arc(px, py, 3, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0, 245, 212, ${1 - pulse.progress})`;
        ctx.fill();
      }

      // Particles
      particles.forEach(p => {
        const x = p.px * w;
        const y = p.py * h;
        const pulse = Math.sin(time * 2 + p.pulsePhase) * 0.3 + 0.7;
        const size = p.size * pulse;

        // Glow
        const glow = ctx.createRadialGradient(x, y, 0, x, y, size * 6);
        glow.addColorStop(0, `rgba(0, 245, 212, ${0.35 * pulse})`);
        glow.addColorStop(0.5, `rgba(0, 230, 118, ${0.12 * pulse})`);
        glow.addColorStop(1, 'rgba(0, 245, 212, 0)');
        ctx.fillStyle = glow;
        ctx.fillRect(x - size * 6, y - size * 6, size * 12, size * 12);

        // Core
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(224, 255, 250, ${0.9 * pulse})`;
        ctx.fill();
      });

      animId = requestAnimationFrame(draw);
    };

    draw();

    const handleResize = () => {
      const dims = resize();
      w = dims.w;
      h = dims.h;
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  useEffect(() => {
    if (onRep && stateRef.current) {
      const interval = setInterval(() => {
        stateRef.current.triggerPulse('spine', 'lHip');
        setTimeout(() => stateRef.current.triggerPulse('spine', 'rHip'), 100);
        onRep();
      }, 1800);
      return () => clearInterval(interval);
    }
  }, [onRep]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ width: '100%', height: '100%' }}
    />
  );
}
