"use client"

import type { CSSProperties } from "react"
import { useEffect, useRef, useState } from "react"
import { useTheme } from "next-themes"
import { cn } from "@/lib/utils"
import "@/app/cosmic-effects.css"

export interface MeteorsProps {
  className?: string
  children?: React.ReactNode
  count?: number
  intervalSeconds?: number
  durationMin?: number
  durationMax?: number
  /** Brightness variant - 'normal' or 'bright' */
  brightness?: "normal" | "bright"
}

interface MeteorData {
  id: number
  top: number
  left: number
  delay: number
  duration: number
  angle: number
  length: number
  travelX: number
  travelY: number
  isBright: boolean
}

export function Meteors({
  className,
  children,
  count = 4,
  intervalSeconds = 14,
  durationMin = 11,
  durationMax = 16,
  brightness = "normal",
}: MeteorsProps) {
  const [meteors, setMeteors] = useState<MeteorData[]>([])
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const nextIdRef = useRef(0)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    const isDark = mounted ? resolvedTheme === "dark" : false
    if (!isDark) return

    /** Cap concurrent meteors so overlapping waves stay sparse (was effectively unbounded vs 80). */
    const maxConcurrent = Math.min(14, count * 2)

    const createMeteor = (): MeteorData => {
      nextIdRef.current += 1
      const isBright = brightness === "bright" || Math.random() > 0.55
      const entersFromTop = Math.random() > 0.38
      const angle = 24 + Math.random() * 12
      const length = 52 + Math.random() * 22
      /*
        Full viewport sweep: translation must clear width + height from any spawn.
        Top entries: from upper sky, exit past bottom-right. Side entries: past opposite corner.
      */
      const travelX = 118 + Math.random() * 32
      const travelY = 102 + Math.random() * 30

      return {
        id: nextIdRef.current,
        top: entersFromTop
          ? -22 - Math.random() * 14
          : -6 + Math.random() * 88,
        left: entersFromTop
          ? -20 + Math.random() * 98
          : -14 - Math.random() * 8,
        delay: Math.random() * 2.2,
        duration: durationMin + Math.random() * (durationMax - durationMin),
        angle,
        length,
        travelX,
        travelY,
        isBright,
      }
    }

    const spawnWave = () =>
      Array.from({ length: count }, () => createMeteor())

    setMeteors(spawnWave())

    if (intervalSeconds > 0) {
      const timer = setInterval(() => {
        setMeteors((prev) => {
          const merged = [...prev, ...spawnWave()]
          return merged.length > maxConcurrent
            ? merged.slice(-maxConcurrent)
            : merged
        })
      }, intervalSeconds * 1000)
      return () => clearInterval(timer)
    }
  }, [count, intervalSeconds, durationMin, durationMax, brightness, mounted, resolvedTheme])

  const isDark = mounted ? resolvedTheme === "dark" : false
  if (!isDark) return null

  return (
    <div
      className={cn(
        "pointer-events-none fixed inset-0 bg-transparent",
        className,
      )}
    >
      {meteors.map((meteor) => (
        <div
          className="meteor-enhanced-wrapper absolute"
          key={meteor.id}
          onAnimationEnd={() => {
            setMeteors((prev) => prev.filter((m) => m.id !== meteor.id))
          }}
          style={
            {
              top: `${meteor.top}%`,
              left: `${meteor.left}%`,
              animationDuration: `${meteor.duration}s`,
              animationDelay: `${meteor.delay}s`,
              "--meteor-angle": `${meteor.angle}deg`,
              "--meteor-length": `${meteor.length}px`,
              "--meteor-travel-x": `${meteor.travelX}vw`,
              "--meteor-travel-y": `${meteor.travelY}vh`,
            } as CSSProperties
          }
        >
          <div
            className={cn("meteor-enhanced", meteor.isBright && "meteor-bright")}
          />
        </div>
      ))}

      {/* Meteors only - no children wrapper, meteors stay at low z-index */}
    </div>
  )
}
