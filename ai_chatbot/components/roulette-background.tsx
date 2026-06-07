"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import styles from "@/app/(chat)/roulette/roulette.module.css";
import egtLogo from "@/app/mp4_background/egt.png";

const ROULETTE_NUMBERS = [
  32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16,
  33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26, 0,
];

const SPIN_DURATION_MS = 9000;

/**
 * Decorative roulette wheel for auth pages. Slowly rotating wheel with EGT logo.
 * Spin button triggers the wheel to spin in place.
 */
export function RouletteBackground({ className }: { className?: string }) {
  const [spinTo, setSpinTo] = useState<string | null>(null);
  const [rest, setRest] = useState(false);
  const restTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (restTimerRef.current) {
        clearTimeout(restTimerRef.current);
      }
    },
    []
  );

  const handleSpin = useCallback(() => {
    if (restTimerRef.current) {
      clearTimeout(restTimerRef.current);
      restTimerRef.current = null;
    }

    const slotIndex = Math.floor(Math.random() * 37);
    const newValue = String(slotIndex);

    setSpinTo(null);
    setRest(false);

    restTimerRef.current = setTimeout(() => {
      restTimerRef.current = null;
      setRest(true);
    }, SPIN_DURATION_MS);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setSpinTo(newValue);
      });
    });
  }, []);

  return (
    <div className="roulette-bg relative flex flex-1 flex-col items-center justify-center">
      <style>{`
        .roulette-bg .inner::after {
          background-color: #0d0002;
          border-color: #3a352d;
        }
        .roulette-bg .plate::before {
          background: rgba(0, 0, 0, 0.88);
        }
      `}</style>
      <div
        aria-hidden="true"
        className={`pointer-events-none flex flex-1 items-center justify-center ${className ?? ""}`}
        style={{
          maskImage:
            "linear-gradient(to right, transparent 20%, black 40%, black 60%, transparent 80%), linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%)",
          WebkitMaskImage:
            "linear-gradient(to right, transparent 20%, black 40%, black 60%, transparent 80%), linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%)",
        }}
      >
        <div
          aria-label="Decorative roulette wheel"
          className={styles.plate}
          role="img"
        >
          <ul
            className={`${styles.inner} ${rest ? styles.rest : ""}`}
            data-spinto={spinTo ?? undefined}
          >
            {ROULETTE_NUMBERS.map((num) => (
              <li className={styles.number} key={num}>
                <label>
                  <input
                    defaultChecked={false}
                    name="pit-bg"
                    readOnly
                    type="radio"
                    value={num}
                  />
                  <span className={styles.pit}>{num}</span>
                </label>
              </li>
            ))}
          </ul>

          <div
            className={styles.data}
            style={{
              top: "30%",
              right: "30%",
              bottom: "30%",
              left: "30%",
            }}
          >
            <div className={styles.dataInner}>
              <div
                className={styles.mask}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 0,
                  position: "relative",
                }}
              >
                <Image
                  alt=""
                  height={300}
                  src={egtLogo}
                  style={{
                    width: "380%",
                    height: "380%",
                    objectFit: "contain",
                    transform: "translateY(18%)",
                  }}
                  width={300}
                />
                <div
                  aria-hidden="true"
                  style={{
                    position: "absolute",
                    inset: 0,
                    background:
                      "linear-gradient(to bottom, transparent 93%, rgba(0,0,0,0.6) 97%, rgba(0,0,0,0.9) 100%)",
                    pointerEvents: "none",
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
      <button
        className="absolute top-[61%] left-1/2 z-[9999] -translate-x-1/2 -translate-y-1/2 cursor-pointer rounded-lg border-2 border-[#c9a227] px-6 py-2.5 font-semibold text-white uppercase tracking-widest transition-colors hover:bg-[hsl(345_75%_36%)]"
        onClick={handleSpin}
        style={{
          background: "linear-gradient(145deg, #8b1538, #5c0e26)",
        }}
        type="button"
      >
        Spin
      </button>
    </div>
  );
}
