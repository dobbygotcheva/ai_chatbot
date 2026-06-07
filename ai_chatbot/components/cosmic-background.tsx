"use client";

import { useCallback, useEffect, useRef } from "react";
import "@/app/cosmic-effects.css";

type Particle = {
  x: number;
  y: number;
  size: number;
  speedX: number;
  speedY: number;
  opacity: number;
  twinkleSpeed: number;
  twinklePhase: number;
  hue: number;
};

const PARTICLE_COUNT = 180;
const NEBULA_PARTICLE_COUNT = 12;

type NebulaBlob = {
  x: number;
  y: number;
  radius: number;
  hue: number;
  saturation: number;
  opacity: number;
  driftX: number;
  driftY: number;
  pulseSpeed: number;
  pulsePhase: number;
};

function createParticle(w: number, h: number): Particle {
  return {
    x: Math.random() * w,
    y: Math.random() * h,
    size: Math.random() * 3.5 + 0.8,
    speedX: (Math.random() - 0.5) * 0.2,
    speedY: (Math.random() - 0.5) * 0.15 - 0.08,
    opacity: Math.random() * 0.8 + 0.4,
    twinkleSpeed: Math.random() * 0.03 + 0.01,
    twinklePhase: Math.random() * Math.PI * 2,
    hue: Math.random() > 0.6 ? 30 + Math.random() * 30 : 0 + Math.random() * 20,
  };
}

function createNebulaBlob(w: number, h: number): NebulaBlob {
  return {
    x: Math.random() * w,
    y: Math.random() * h,
    radius: 200 + Math.random() * 300,
    hue:
      Math.random() > 0.5 ? 350 + Math.random() * 20 : 15 + Math.random() * 30,
    saturation: 50 + Math.random() * 35,
    opacity: 0.05 + Math.random() * 0.06,
    driftX: (Math.random() - 0.5) * 0.1,
    driftY: (Math.random() - 0.5) * 0.08,
    pulseSpeed: 0.004 + Math.random() * 0.005,
    pulsePhase: Math.random() * Math.PI * 2,
  };
}

export function CosmicBackground({ className = "" }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const nebulaRef = useRef<NebulaBlob[]>([]);
  const frameRef = useRef(0);
  const animRef = useRef<number>(0);

  const initParticles = useCallback((w: number, h: number) => {
    particlesRef.current = Array.from({ length: PARTICLE_COUNT }, () =>
      createParticle(w, h)
    );
    nebulaRef.current = Array.from({ length: NEBULA_PARTICLE_COUNT }, () =>
      createNebulaBlob(w, h)
    );
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      initParticles(window.innerWidth, window.innerHeight);
    };

    resize();
    window.addEventListener("resize", resize);

    // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Animation loop is inherently complex with multiple particle calculations
    const animate = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      frameRef.current += 1;

      ctx.clearRect(0, 0, w, h);

      for (const blob of nebulaRef.current) {
        blob.x += blob.driftX;
        blob.y += blob.driftY;

        if (blob.x < -blob.radius) {
          blob.x = w + blob.radius;
        }
        if (blob.x > w + blob.radius) {
          blob.x = -blob.radius;
        }
        if (blob.y < -blob.radius) {
          blob.y = h + blob.radius;
        }
        if (blob.y > h + blob.radius) {
          blob.y = -blob.radius;
        }

        const pulse =
          blob.opacity +
          Math.sin(frameRef.current * blob.pulseSpeed + blob.pulsePhase) *
            0.015;
        const grad = ctx.createRadialGradient(
          blob.x,
          blob.y,
          0,
          blob.x,
          blob.y,
          blob.radius
        );
        grad.addColorStop(
          0,
          `hsla(${blob.hue}, ${blob.saturation}%, 50%, ${pulse})`
        );
        grad.addColorStop(1, "hsla(0, 0%, 0%, 0)");
        ctx.fillStyle = grad;
        ctx.fillRect(
          blob.x - blob.radius,
          blob.y - blob.radius,
          blob.radius * 2,
          blob.radius * 2
        );
      }

      for (const p of particlesRef.current) {
        p.x += p.speedX;
        p.y += p.speedY;

        if (p.x < 0) {
          p.x = w;
        }
        if (p.x > w) {
          p.x = 0;
        }
        if (p.y < 0) {
          p.y = h;
        }
        if (p.y > h) {
          p.y = 0;
        }

        const twinkle =
          p.opacity *
          (0.5 +
            0.5 * Math.sin(frameRef.current * p.twinkleSpeed + p.twinklePhase));

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${p.hue}, 70%, 85%, ${twinkle})`;
        ctx.fill();

        // Enhanced glow for all particles
        const glowSize = p.size * 6;
        const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, glowSize);
        glow.addColorStop(0, `hsla(${p.hue}, 75%, 80%, ${twinkle * 0.5})`);
        glow.addColorStop(0.4, `hsla(${p.hue}, 65%, 70%, ${twinkle * 0.2})`);
        glow.addColorStop(1, "hsla(0, 0%, 0%, 0)");
        ctx.fillStyle = glow;
        ctx.fillRect(
          p.x - glowSize,
          p.y - glowSize,
          glowSize * 2,
          glowSize * 2
        );

        // Add sparkle cross for larger stars
        if (p.size > 2) {
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.beginPath();
          ctx.moveTo(-p.size * 3, 0);
          ctx.lineTo(p.size * 3, 0);
          ctx.moveTo(0, -p.size * 3);
          ctx.lineTo(0, p.size * 3);
          ctx.strokeStyle = `hsla(${p.hue}, 80%, 90%, ${twinkle * 0.4})`;
          ctx.lineWidth = 0.5;
          ctx.stroke();
          ctx.restore();
        }
      }

      animRef.current = requestAnimationFrame(animate);
    };

    animRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener("resize", resize);
    };
  }, [initParticles]);

  return (
    <div
      aria-hidden
      className={`cosmic-bg-root overflow-hidden ${className}`.trim()}
    >
      <div className="cosmic-sky-image" />
      <div className="cosmic-vignette" />
      <canvas className="cosmic-canvas" ref={canvasRef} />
      <div className="cosmic-haze" />
      <div className="cosmic-streak cosmic-streak-1" />
      <div className="cosmic-streak cosmic-streak-2" />
      <div className="cosmic-streak cosmic-streak-3" />
    </div>
  );
}
