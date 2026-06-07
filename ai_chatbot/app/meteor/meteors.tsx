"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import "@/app/cosmic-effects.css";

export interface MeteorsProps {
  className?: string;
  children?: React.ReactNode;
  /** Number of meteors */
  count?: number;
  /** Meteor angle in degrees (215 = diagonal down-left) */
  angle?: number;
  /** Brightness variant - 'normal' or 'bright' */
  brightness?: "normal" | "bright";
}

interface MeteorData {
  id: number;
  left: number;
  delay: number;
  duration: number;
  isBright: boolean;
}

export function Meteors({
  className,
  children,
  count = 30,
  angle = 215,
  brightness = "bright",
}: MeteorsProps) {
  const [meteors, setMeteors] = useState<MeteorData[]>([]);

  // Generate meteor data on client only to avoid hydration mismatch
  useEffect(() => {
    setMeteors(
      Array.from({ length: count }, (_, i) => ({
        id: i,
        left: i * (100 / count), // Evenly distribute across width
        delay: Math.random() * 6,
        duration: 10 + Math.random() * 8,
        isBright: brightness === "bright" || Math.random() > 0.6,
      }))
    );
  }, [count, brightness]);

  return (
    <div
      className={cn("fixed inset-0 overflow-hidden bg-transparent", className)}
    >
      {/* Custom angle via CSS variable */}
      <style>{`
        .meteor-container-${angle} {
          --meteor-angle: ${angle}deg;
        }
      `}</style>

      {/* Meteors */}
      {meteors.map((meteor) => (
        <span
          className={`meteor-enhanced ${meteor.isBright ? "meteor-bright" : ""}`}
          key={meteor.id}
          style={{
            top: "-40px",
            left: `${meteor.left}%`,
            animationDuration: `${meteor.duration}s`,
            animationDelay: `${meteor.delay}s`,
          }}
        />
      ))}

      {/* Content layer */}
      {children && (
        <div className="relative z-10 h-full w-full">{children}</div>
      )}
    </div>
  );
}

export default function MeteorsDemo() {
  return <Meteors />;
}
