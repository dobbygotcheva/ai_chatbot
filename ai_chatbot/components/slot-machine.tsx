"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const REELS_COUNT = 3;
const SYMBOLS = ["E", "G", "T", "7", "★", "♦", "♥", "♣"];
const INITIAL_DISPLAY = ["E", "G", "T"];
const SYMBOL_HEIGHT = 72;
const REEL_HEIGHT = 144;
const PAGE = SYMBOLS.length * SYMBOL_HEIGHT;
const PAGE_OFFSET = PAGE - SYMBOL_HEIGHT;
const CENTER = REEL_HEIGHT / 2 - SYMBOL_HEIGHT / 2;
const SPIN_STEP = 30;
const DRAG_FORCE = 0.005;
const FRICTION_FREE_ITERATIONS = 10;
const DRAG_THRESHOLD = 20;
const SPIN_DELAY = 250;
const FRAME_RATE = 1000 / 30;
const AUTOPLAY_DELAY = 3000;
const JACKPOT_CHANCE = 0.55;

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

interface SymbolEntry {
  el: HTMLDivElement;
  symbol: string;
}

class ReelController {
  private readonly symbols: SymbolEntry[];
  private readonly reel: HTMLDivElement;
  private interval: ReturnType<typeof setInterval> | null = null;

  constructor(parent: HTMLDivElement, initialSymbol: string) {
    this.reel = document.createElement("div");
    this.reel.className = "slot-reel";
    parent.appendChild(this.reel);

    const ordered = shuffleArray([...SYMBOLS]);
    const targetIdx = ordered.indexOf(initialSymbol);
    if (targetIdx !== 1) {
      [ordered[1], ordered[targetIdx]] = [ordered[targetIdx], ordered[1]];
    }

    this.symbols = ordered.map((symbol, index) => {
      const div = document.createElement("div");
      div.className = "slot-symbol";
      div.style.bottom = `${SYMBOL_HEIGHT * index - SYMBOL_HEIGHT / 2}px`;
      div.textContent = symbol;
      return { el: div, symbol };
    });

    const symbolsToRender = Math.ceil(REEL_HEIGHT / SYMBOL_HEIGHT) + 1;
    for (let i = 0; i < symbolsToRender && i < this.symbols.length; i++) {
      this.reel.appendChild(this.symbols[i].el);
    }
  }

  spin(winSymbol: string, onComplete: () => void) {
    let step = SPIN_STEP;
    let friction = 0;
    let iteration = 0;

    if (this.interval) {
      clearInterval(this.interval);
    }

    // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Animation loop handles spinning physics, friction, win conditions, and symbol positioning
    this.interval = setInterval(() => {
      if (step <= 0) {
        if (this.interval) {
          clearInterval(this.interval);
        }
        return;
      }

      let winSymbolDistance = 0;

      for (const sym of this.symbols) {
        const bottom = Number.parseFloat(sym.el.style.bottom) || 0;
        let newBottom = bottom - step;
        if (newBottom < REEL_HEIGHT - PAGE) {
          newBottom += PAGE;
        }

        sym.el.style.bottom = `${newBottom}px`;

        const rendered = this.reel.contains(sym.el);
        if (newBottom <= -SYMBOL_HEIGHT) {
          if (rendered) {
            sym.el.remove();
          }
        } else if (newBottom <= REEL_HEIGHT && !rendered) {
          this.reel.append(sym.el);
        }

        if (sym.symbol === winSymbol) {
          const distance = newBottom < 0 ? newBottom + PAGE_OFFSET : newBottom;
          winSymbolDistance = distance - CENTER;
        }
      }

      if (iteration > FRICTION_FREE_ITERATIONS) {
        const force = friction * DRAG_FORCE;
        const newStep = step - force;

        if (newStep > DRAG_THRESHOLD) {
          step = newStep;
          friction++;
        } else if (winSymbolDistance > 0) {
          const decelerationFactor = step / winSymbolDistance;
          const easing = decelerationFactor ** 2;
          step -= easing * step;

          if (winSymbolDistance < 0.01) {
            onComplete();
            if (this.interval) {
              clearInterval(this.interval);
            }
          } else if (step <= 0) {
            step = 5;
          }
        }
      }

      iteration++;
    }, FRAME_RATE);
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
    }
  }

  destroy() {
    this.stop();
    this.reel.remove();
  }
}

export function SlotMachine({ autoplay = true }: { autoplay?: boolean }) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const reelsRef = useRef<ReelController[]>([]);
  const autoplayRef = useRef(autoplay);
  const mountedRef = useRef(true);
  const doneRef = useRef(0);
  const jackpotRef = useRef(false);
  const [showJackpot, setShowJackpot] = useState(false);

  autoplayRef.current = autoplay;

  const randomSpin = useCallback(() => {
    if (!mountedRef.current) {
      return;
    }
    const reels = reelsRef.current;
    if (reels.length === 0) {
      return;
    }

    doneRef.current = 0;

    const isJackpot = Math.random() < JACKPOT_CHANCE;
    jackpotRef.current = isJackpot;

    for (let i = 0; i < REELS_COUNT; i++) {
      const winSymbol = isJackpot
        ? INITIAL_DISPLAY[i]
        : SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
      const j = i;
      setTimeout(() => {
        if (!mountedRef.current) {
          return;
        }
        reels[j]?.spin(winSymbol, () => {
          doneRef.current++;
          if (doneRef.current === REELS_COUNT) {
            if (jackpotRef.current && mountedRef.current) {
              setShowJackpot(true);
              setTimeout(() => {
                if (mountedRef.current) {
                  setShowJackpot(false);
                }
              }, 2200);
            }
            if (autoplayRef.current && mountedRef.current) {
              setTimeout(() => randomSpin(), AUTOPLAY_DELAY);
            }
          }
        });
      }, j * SPIN_DELAY);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    const viewport = viewportRef.current;
    if (!viewport) {
      return;
    }

    viewport.innerHTML = "";
    reelsRef.current = [];

    for (let i = 0; i < REELS_COUNT; i++) {
      reelsRef.current.push(new ReelController(viewport, INITIAL_DISPLAY[i]));
    }

    const timer = setTimeout(() => randomSpin(), 600);

    return () => {
      mountedRef.current = false;
      clearTimeout(timer);
      for (const reel of reelsRef.current) {
        reel.destroy();
      }
      reelsRef.current = [];
    };
  }, [randomSpin]);

  return (
    <>
      <style>{`
        .slot-machine {
          display: flex;
          flex-direction: column;
          align-items: center;
          animation: slot-arrive 0.8s cubic-bezier(0.16, 1, 0.3, 1) both;
          width: 100%;
          max-width: 24rem;
        }
        @keyframes slot-arrive {
          0% { opacity: 0; transform: translateY(-12px) scale(0.97); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        .slot-frame {
          position: relative;
          width: 100%;
          background: rgba(0, 0, 0, 0.4);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-bottom: none;
          border-radius: 16px 16px 0 0;
          padding: 12px 12px 8px;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.05);
        }
        .slot-viewport {
          position: relative;
          height: ${REEL_HEIGHT}px;
          width: 100%;
          border-radius: 10px;
          overflow: hidden;
          background: rgba(0, 0, 0, 0.6);
          box-shadow: inset 0 2px 12px rgba(0,0,0,0.8), inset 0 0 0 1px rgba(255,255,255,0.04);
        }
        .slot-viewport::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(180deg,
            rgba(0,0,0,0.7) 0%,
            rgba(0,0,0,0.25) 22%,
            transparent 42%,
            transparent 58%,
            rgba(0,0,0,0.25) 78%,
            rgba(0,0,0,0.7) 100%
          );
          pointer-events: none;
          z-index: 2;
          border-radius: 10px;
        }
        .slot-reels {
          display: flex;
          gap: 2px;
          height: 100%;
          padding: 0 2px;
        }
        .slot-reel {
          position: relative;
          flex: 1;
          height: 100%;
          overflow: hidden;
          background: rgba(255,255,255,0.01);
          border-radius: 6px;
        }
        .slot-symbol {
          position: absolute;
          width: 100%;
          height: ${SYMBOL_HEIGHT}px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 2rem;
          font-weight: 800;
          color: rgba(255, 255, 255, 0.9);
          text-shadow: 0 0 12px rgba(255, 255, 255, 0.2), 0 1px 2px rgba(0,0,0,0.5);
          font-family: 'Georgia', 'Times New Roman', serif;
          letter-spacing: 0.02em;
        }
        .slot-center-line {
          position: absolute;
          left: 2px;
          right: 2px;
          top: 50%;
          transform: translateY(-1px);
          height: 1px;
          background: linear-gradient(90deg,
            transparent 5%,
            rgba(255, 255, 255, 0.15) 30%,
            rgba(255, 255, 255, 0.25) 50%,
            rgba(255, 255, 255, 0.15) 70%,
            transparent 95%
          );
          z-index: 5;
          pointer-events: none;
        }
        .slot-jackpot-overlay {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.1rem;
          font-weight: 800;
          color: #fff;
          text-shadow: 0 0 24px rgba(255, 255, 255, 0.8), 0 0 48px rgb(var(--brand-rgb) / 0.5);
          letter-spacing: 0.3em;
          z-index: 10;
          pointer-events: none;
          animation: jackpot-flash 2.2s ease-out forwards;
          background: radial-gradient(ellipse at center, rgb(var(--brand-rgb) / 0.2) 0%, rgba(0,0,0,0.3) 100%);
          border-radius: 10px;
        }
        @keyframes jackpot-flash {
          0% { opacity: 0; transform: scale(0.6); }
          12% { opacity: 1; transform: scale(1.08); }
          30% { transform: scale(1); }
          75% { opacity: 1; }
          100% { opacity: 0; }
        }
      `}</style>
      <div className="slot-machine">
        <div className="slot-frame">
          <div className="slot-viewport">
            <div className="slot-reels" ref={viewportRef} />
            <div aria-hidden="true" className="slot-center-line" />
            {showJackpot && (
              <div aria-hidden="true" className="slot-jackpot-overlay">
                E &thinsp; G &thinsp; T
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
