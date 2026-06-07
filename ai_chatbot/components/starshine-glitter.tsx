"use client";

import { useTheme } from "next-themes";
import { useEffect, useRef, useState } from "react";
import {
  buildConstellationStarStyle,
  mapStarToViewport,
  NIGHT_SKY_CONSTELLATIONS,
} from "@/lib/night-sky-constellations";
import { cn } from "@/lib/utils";
import "@/app/cosmic-effects.css";

/** Skew toward tiny pinpoints (most real stars are sub-pixel visually). */
function randomStarSize(): number {
  return Math.random() ** 1.75 * 2.35 + 0.32;
}

/** Dark sky: mix of hot blue-whites, neutral sun-like, and a few warm / ruddy stars. */
function randomDarkStarStyle(): {
  background: string;
  boxShadow: string;
  opacity: number;
} {
  const roll = Math.random();
  let h: number;
  let s: number;
  let l: number;

  if (roll < 0.58) {
    h = 198 + Math.random() * 42;
    s = 7 + Math.random() * 22;
    l = 87 + Math.random() * 11;
  } else if (roll < 0.82) {
    h = 0;
    s = 0;
    l = 91 + Math.random() * 8;
  } else if (roll < 0.94) {
    h = 36 + Math.random() * 20;
    s = 14 + Math.random() * 32;
    l = 84 + Math.random() * 12;
  } else {
    h = 8 + Math.random() * 18;
    s = 28 + Math.random() * 38;
    l = 72 + Math.random() * 14;
  }

  const background =
    s === 0
      ? `hsl(0 0% ${l.toFixed(1)}%)`
      : `hsl(${h.toFixed(1)} ${s.toFixed(1)}% ${l.toFixed(1)}%)`;

  const opacity = 0.315 + Math.random() * 0.4;
  /* Static “specular” stack: bright pin + soft bloom + faint halo (no motion). */
  const pin = 0.465 + Math.random() * 0.38;
  const bloom = 0.102 + Math.random() * 0.13;
  const halo = 0.041 + Math.random() * 0.058;
  const boxShadow = [
    `0 0 0.45px 0.3px rgba(255,255,255,${pin.toFixed(3)})`,
    `0 0 1.15px 0.55px rgba(255,255,255,${bloom.toFixed(3)})`,
    `0 0 2.8px 1.05px rgba(198,218,255,${halo.toFixed(3)})`,
  ].join(", ");

  return { background, boxShadow, opacity };
}

/** Day / light UI: faint cool specks only. */
function randomLightStarStyle(): {
  background: string;
  boxShadow: string;
  opacity: number;
} {
  const h = 212 + Math.random() * 28;
  const s = 9 + Math.random() * 14;
  const l = 36 + Math.random() * 16;
  const background = `hsl(${h.toFixed(1)} ${s.toFixed(1)}% ${l.toFixed(1)}%)`;
  const opacity = 0.216 + Math.random() * 0.22;
  const pin = 0.254 + Math.random() * 0.22;
  const bloom = 0.07 + Math.random() * 0.09;
  const halo = 0.035 + Math.random() * 0.054;
  const boxShadow = [
    `0 0 0.5px 0.35px hsl(${h.toFixed(1)} ${s.toFixed(1)}% ${(l + 8).toFixed(1)}% / ${pin.toFixed(3)})`,
    `0 0 1.1px 0.5px hsl(${h.toFixed(1)} ${s.toFixed(1)}% ${l.toFixed(1)}% / ${bloom.toFixed(3)})`,
    `0 0 2.5px 0.95px hsl(220 30% 62% / ${halo.toFixed(3)})`,
  ].join(", ");
  return { background, boxShadow, opacity };
}

export function StarshineGlitter({
  className,
  count = 56,
}: {
  className?: string;
  count?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !mounted) {
      return;
    }

    const isDark = resolvedTheme === "dark";

    container.innerHTML = "";

    for (let i = 0; i < count; i++) {
      const star = document.createElement("div");
      star.className = "starshine-star";
      const size = randomStarSize();
      const style = isDark ? randomDarkStarStyle() : randomLightStarStyle();

      star.style.cssText = `
        position:absolute;
        border-radius:50%;
        width:${size}px;
        height:${size}px;
        left:${Math.random() * 100}%;
        top:${Math.random() * 100}%;
        background:${style.background};
        opacity:${style.opacity};
        box-shadow:${style.boxShadow};
      `;

      container.appendChild(star);
    }

    for (const constellation of NIGHT_SKY_CONSTELLATIONS) {
      for (const def of constellation.stars) {
        const star = document.createElement("div");
        star.className = "starshine-star";
        const { left, top } = mapStarToViewport(
          def.lx,
          def.ly,
          constellation.region
        );
        const style = buildConstellationStarStyle(def, isDark);

        star.style.cssText = `
        position:absolute;
        border-radius:50%;
        width:${style.sizePx}px;
        height:${style.sizePx}px;
        left:${left}%;
        top:${top}%;
        background:${style.background};
        opacity:${style.opacity};
        box-shadow:${style.boxShadow};
      `;

        container.appendChild(star);
      }
    }

    return () => {
      container.innerHTML = "";
    };
  }, [count, mounted, resolvedTheme]);

  if (!mounted || resolvedTheme !== "dark") {
    return null;
  }

  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none fixed inset-0 overflow-hidden",
        className
      )}
      ref={containerRef}
    />
  );
}
