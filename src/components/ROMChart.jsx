import { useEffect, useRef } from 'react';

export default function ROMChart({ data, className = '' }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.parentElement.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const w = rect.width;
    const h = 80;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    // Generate points if no data provided
    const points = data || [];
    if (points.length === 0) {
      for (let i = 0; i <= 60; i++) {
        const t = i / 60;
        const y = 0.5 + Math.sin(t * Math.PI * 4) * 0.25 + Math.sin(t * Math.PI * 8) * 0.08;
        points.push({ x: t * w, y: (1 - y) * h * 0.7 + h * 0.15 });
      }
    }

    // Gradient fill
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, 'rgba(0, 245, 212, 0.18)');
    grad.addColorStop(1, 'rgba(0, 245, 212, 0)');

    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    points.forEach(p => ctx.lineTo(p.x, p.y));
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // Line
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    points.forEach(p => ctx.lineTo(p.x, p.y));
    ctx.strokeStyle = '#00f5d4';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowColor = 'rgba(0, 245, 212, 0.4)';
    ctx.shadowBlur = 10;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Rep markers
    const repPositions = [0.15, 0.35, 0.55, 0.75, 0.95];
    repPositions.forEach(rp => {
      const idx = Math.floor(rp * points.length);
      const p = points[Math.min(idx, points.length - 1)];
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#00f5d4';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(p.x, p.y, 8, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(0, 245, 212, 0.25)';
      ctx.lineWidth = 1;
      ctx.stroke();
    });
  }, [data]);

  return <canvas ref={canvasRef} className={className} style={{ width: '100%', height: 80 }} />;
}
