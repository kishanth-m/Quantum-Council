import React, { useEffect, useRef, useState } from 'react';
import { getSavedTheme, getSavedMotion, MotionPreference, ThemeDefinition, hexToRgb } from '../../styles/themes';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  baseAlpha: number;
  phase: number;
  color: string;
}

export const AnimatedBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [motion, setMotion] = useState<MotionPreference>(getSavedMotion());
  const [currentTheme, setCurrentTheme] = useState<ThemeDefinition>(getSavedTheme());

  useEffect(() => {
    const handleThemeChange = (e: any) => {
      if (e.detail) setCurrentTheme(e.detail);
    };
    const handleMotionChange = (e: any) => {
      if (e.detail) setMotion(e.detail);
    };

    window.addEventListener('theme-changed', handleThemeChange);
    window.addEventListener('motion-changed', handleMotionChange);

    return () => {
      window.removeEventListener('theme-changed', handleThemeChange);
      window.removeEventListener('motion-changed', handleMotionChange);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let animationFrameId: number;
    const dpr = Math.max(1, window.devicePixelRatio || 1);

    const resize = () => {
      if (!canvas) return;
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.scale(dpr, dpr);
    };

    resize();
    window.addEventListener('resize', resize);

    const [, , , accentPrimary, accentSecondary, accentHighlight] = currentTheme.palette;
    const sRgb = hexToRgb(accentSecondary);
    const pRgb = hexToRgb(accentPrimary);
    const hRgb = hexToRgb(accentHighlight);

    if (motion === 'off') {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      return () => window.removeEventListener('resize', resize);
    }

    // Number of particles & speed based on motion setting
    const count = motion === 'reduced' ? 22 : 44;
    const speedScale = motion === 'reduced' ? 0.20 : 0.55;
    const colors = [
      `rgba(${sRgb}, `,
      `rgba(${pRgb}, `,
      `rgba(${hRgb}, `,
      'rgba(245, 158, 11, ', // Radiant amber ember (Reference 3)
    ];

    const particles: Particle[] = [];
    const w = window.innerWidth;
    const h = window.innerHeight;

    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * speedScale,
        vy: (Math.random() * -0.6 - 0.15) * speedScale, // gentle upward drift
        radius: Math.random() * 2.2 + 1.2,
        baseAlpha: Math.random() * 0.55 + 0.35,
        phase: Math.random() * Math.PI * 2,
        color: colors[i % colors.length],
      });
    }

    let time = 0;

    const render = () => {
      const curW = window.innerWidth;
      const curH = window.innerHeight;
      time += 0.015;

      ctx.clearRect(0, 0, curW, curH);

      // ─── 1. Neural Web Filaments ───
      if (motion === 'on') {
        const maxDist = 120;
        ctx.lineWidth = 0.65;
        for (let i = 0; i < particles.length; i++) {
          for (let j = i + 1; j < particles.length; j++) {
            const dx = particles[i].x - particles[j].x;
            const dy = particles[i].y - particles[j].y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < maxDist) {
              const alpha = (1 - dist / maxDist) * 0.18;
              ctx.strokeStyle = `rgba(${sRgb}, ${alpha.toFixed(3)})`;
              ctx.beginPath();
              ctx.moveTo(particles[i].x, particles[i].y);
              ctx.lineTo(particles[j].x, particles[j].y);
              ctx.stroke();
            }
          }
        }
      }

      // ─── 2. Glowing Starlight & Ember Particles ───
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;

        // Wrap around seamlessly
        if (p.x < 0) p.x = curW;
        if (p.x > curW) p.x = 0;
        if (p.y < 0) p.y = curH;
        if (p.y > curH) p.y = 0;

        const alpha = p.baseAlpha * (0.75 + 0.25 * Math.sin(time * 2.0 + p.phase));

        // Fast high-performance dual-layer specular glow (replaces heavy canvas shadowBlur)
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius * 2.4, 0, Math.PI * 2);
        ctx.fillStyle = `${p.color}${(alpha * 0.25).toFixed(3)})`;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `${p.color}${Math.min(alpha, 1).toFixed(3)})`;
        ctx.fill();
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', resize);
    };
  }, [motion, currentTheme]);

  const [bgPrimary, , bgElevated, accentPrimary, accentSecondary, accentHighlight] = currentTheme.palette;

  return (
    <div
      className="fixed inset-0 pointer-events-none z-0 overflow-hidden"
      style={{ backgroundColor: bgPrimary }}
      aria-hidden="true"
    >
      {/* ─── LAYER 1: GPU-ACCELERATED DYNAMIC AMBIENT PLASMA ORBS (Matching References 2 & 3) ─── */}
      {motion !== 'off' ? (
        <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-85">
          {/* Orb 1: Electric Cyan Aurora (Top Right) */}
          <div
            className="animate-ambient-orb-1 absolute -top-[15%] right-[5%] w-[580px] h-[580px] rounded-full blur-[110px]"
            style={{
              background: `radial-gradient(circle, ${accentSecondary} 0%, ${accentPrimary} 45%, transparent 75%)`,
              opacity: 0.45,
            }}
          />

          {/* Orb 2: Deep Astral Violet Aurora (Bottom Left) */}
          <div
            className="animate-ambient-orb-2 absolute -bottom-[18%] -left-[10%] w-[680px] h-[680px] rounded-full blur-[130px]"
            style={{
              background: `radial-gradient(circle, ${accentHighlight} 0%, #4C1D95 40%, transparent 75%)`,
              opacity: 0.40,
            }}
          />

          {/* Orb 3: Abyssal Oceanic Glow (Top Left / Center) */}
          <div
            className="animate-ambient-orb-3 absolute top-[30%] left-[25%] w-[480px] h-[480px] rounded-full blur-[120px]"
            style={{
              background: `radial-gradient(circle, ${bgElevated} 0%, ${accentPrimary} 35%, transparent 70%)`,
              opacity: 0.35,
            }}
          />

          {/* Orb 4: Radiant Warm Amber Ember Glow (Bottom Right, directly matching Reference 3 NoteWise) */}
          <div
            className="animate-ambient-orb-4 absolute bottom-[10%] right-[10%] w-[520px] h-[520px] rounded-full blur-[115px]"
            style={{
              background: 'radial-gradient(circle, #F59E0B 0%, #D97706 35%, transparent 70%)',
              opacity: 0.30,
            }}
          />
        </div>
      ) : (
        /* Static ambient illumination when motion is turned off */
        <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-40">
          <div
            className="absolute top-[10%] right-[15%] w-[500px] h-[500px] rounded-full blur-[120px]"
            style={{ background: accentSecondary }}
          />
          <div
            className="absolute bottom-[15%] left-[10%] w-[500px] h-[500px] rounded-full blur-[120px]"
            style={{ background: accentHighlight }}
          />
        </div>
      )}

      {/* ─── LAYER 2: HIGH-DPI SPARKLING CELESTIAL CANVAS (Retina-Scaled) ─── */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 pointer-events-none transition-opacity duration-500"
      />

      {/* ─── LAYER 3: CINEMATIC RADIAL VIGNETTE OVERLAY ─── */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at 50% 50%, transparent 40%, rgba(0, 0, 0, 0.65) 100%)',
        }}
      />
    </div>
  );
};
