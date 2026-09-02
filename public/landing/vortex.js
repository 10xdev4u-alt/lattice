/**
 * vortex.js — the hero canvas.
 *
 * A particle vortex: pixels spiral inward toward the knowledge
 * core, growing hotter (violet → vermilion) as they approach.
 * Rendered on a low-res buffer and upscaled with image-rendering:
 * pixelated for the crisp pixel look. Respects
 * prefers-reduced-motion (renders one static frame).
 */

(() => {
  const canvas = document.querySelector('[data-vortex]');
  if (!canvas || !canvas.getContext) return;

  const ctx = canvas.getContext('2d', { alpha: true });
  const W = canvas.width;
  const H = canvas.height;
  const CX = W / 2;
  const CY = H / 2;
  const MAX_R = Math.min(W, H) * 0.5;

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Palette: violet outskirts → vermilion core.
  const COLD = [143, 127, 240];
  const HOT = [255, 77, 46];

  const PARTICLES = 220;
  const particles = [];

  function spawn(edge = false) {
    // Start on a wide orbit; some spawn near the rim for depth.
    const angle = Math.random() * Math.PI * 2;
    const radius = edge ? MAX_R * (0.9 + Math.random() * 0.1) : MAX_R * (0.3 + Math.random() * 0.7);
    return {
      angle,
      radius,
      // Slightly elliptical orbits give the vortex its tilt.
      squash: 0.82 + Math.random() * 0.1,
      speed: 0.0016 + Math.random() * 0.0034, // angular speed
      inward: 0.05 + Math.random() * 0.22,     // px/frame toward core
      size: Math.random() < 0.82 ? 2 : 3,      // px
      phase: Math.random() * Math.PI * 2,
      wobble: 0.5 + Math.random() * 1.5,
    };
  }

  for (let i = 0; i < PARTICLES; i++) particles.push(spawn(i % 3 === 0));

  // Core: a ring lattice — the Lattice mark, drawn as pixels.
  function drawCore(t) {
    const ring = (r, color, width) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.ellipse(CX, CY, r, r * 0.86, 0, 0, Math.PI * 2);
      ctx.stroke();
    };
    const breathe = Math.sin(t * 0.0012) * 3;
    ring(26 + breathe, 'rgba(143,127,240,0.55)', 2);
    ring(44 + breathe * 0.5, 'rgba(143,127,240,0.28)', 2);
    ring(66, 'rgba(255,77,46,0.22)', 2);
    // The pixel core.
    ctx.fillStyle = '#ff4d2e';
    ctx.fillRect(CX - 3, CY - 3, 6, 6);
  }

  function frame(t) {
    ctx.clearRect(0, 0, W, H);

    for (const p of particles) {
      p.angle += p.speed * (1 + (MAX_R - p.radius) / MAX_R * 2.2);
      p.radius -= p.inward * (0.5 + p.wobble * 0.25);

      if (p.radius < 14) {
        // Consumed by the core — respawn on the rim.
        Object.assign(p, spawn(true));
        continue;
      }

      const wob = Math.sin(t * 0.002 + p.phase) * p.wobble;
      const x = CX + Math.cos(p.angle) * (p.radius + wob);
      const y = CY + Math.sin(p.angle) * (p.radius * p.squash + wob);

      // Heat: 0 at rim, 1 at core.
      const heat = 1 - p.radius / MAX_R;
      const r = Math.round(COLD[0] + (HOT[0] - COLD[0]) * heat);
      const g = Math.round(COLD[1] + (HOT[1] - COLD[1]) * heat);
      const b = Math.round(COLD[2] + (HOT[2] - COLD[2]) * heat);
      const alpha = 0.25 + heat * 0.75;

      ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
      ctx.fillRect(x, y, p.size, p.size);

      // Trailing streak on the fastest particles.
      if (p.size === 3 && heat > 0.55) {
        const x2 = CX + Math.cos(p.angle - 0.08) * p.radius;
        const y2 = CY + Math.sin(p.angle - 0.08) * (p.radius * p.squash);
        ctx.fillStyle = `rgba(${r},${g},${b},${alpha * 0.35})`;
        ctx.fillRect(x2, y2, p.size, 1);
      }
    }

    drawCore(t);

    if (!reduced) requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
})();
