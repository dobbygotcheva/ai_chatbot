"use client";

import Image from "next/image";
import { useCallback, useState } from "react";

import egtLogo from "@/app/mp4_background/egt.png";
import { ROULETTE_COLORS } from "@/lib/roulette-constants";

import styles from "./roulette.module.css";

const ROULETTE_NUMBERS = [
  32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16,
  33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26, 0,
];

const RED_NUMBERS = [
  32, 19, 21, 25, 34, 27, 36, 30, 23, 5, 16, 1, 14, 9, 18, 7, 12, 3,
];

const TIMER = 9000;

export default function RoulettePage() {
  const [spinTo, setSpinTo] = useState<string | null>(null);
  const [_maskText, setMaskText] = useState("Place Your Bets");
  const [resultNumber, setResultNumber] = useState<number | null>(null);
  const [resultColor, setResultColor] = useState<string | null>(null);
  const [showSpin, setShowSpin] = useState(true);
  const [disabled, setDisabled] = useState(false);
  const [reveal, setReveal] = useState(false);
  const [rest, setRest] = useState(false);
  const [previousResults, setPreviousResults] = useState<
    Array<{ number: number; color: string }>
  >([]);

  const handleSpin = useCallback(() => {
    const slotIndex = Math.floor(Math.random() * 37);
    const winningNumber = ROULETTE_NUMBERS[slotIndex];
    setSpinTo(String(slotIndex));
    setShowSpin(false);
    setDisabled(true);

    setTimeout(() => {
      setMaskText("No More Bets");
    }, TIMER / 2);

    setTimeout(() => {
      setMaskText("Place Your Bets");
    }, TIMER + 500);

    setTimeout(() => {
      setDisabled(false);
      let color = "black";
      if (RED_NUMBERS.includes(winningNumber)) {
        color = "red";
      }
      if (winningNumber === 0) {
        color = "green";
      }

      setResultNumber(winningNumber);
      setResultColor(color);
      setReveal(true);
      setRest(true);

      setPreviousResults((prev) => [
        { number: winningNumber, color },
        ...prev.slice(0, 9),
      ]);
    }, TIMER);
  }, []);

  const handleReset = useCallback(() => {
    setSpinTo(null);
    setShowSpin(true);
    setResultNumber(null);
    setResultColor(null);
    setReveal(false);
    setRest(false);
  }, []);

  return (
    <div className="flex min-h-dvh w-full flex-col items-center justify-center overflow-auto bg-neutral-950 py-8">
      <div className="flex flex-col items-center">
        <div
          style={{
            position: "relative",
            width: "374px",
            height: "374px",
          }}
        >
          <button
            className={styles.centerButton}
            disabled={disabled}
            onClick={showSpin ? handleSpin : handleReset}
            type="button"
          >
            {showSpin ? "Spin" : "New Game"}
          </button>
          <div
            aria-label="Roulette wheel"
            className={styles.plate}
            id="plate"
            role="img"
            style={{ opacity: disabled ? 0.5 : 1 }}
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
                      name="pit"
                      readOnly
                      type="radio"
                      value={num}
                    />
                    <span className={styles.pit}>{num}</span>
                  </label>
                </li>
              ))}
            </ul>

            <div className={`${styles.data} ${reveal ? styles.reveal : ""}`}>
              <div className={styles.dataInner}>
                <div className={styles.mask}>
                  <Image
                    alt="EGT"
                    className={styles.maskLogo}
                    fill
                    sizes="150px"
                    src={egtLogo}
                  />
                </div>
                <div
                  className={styles.result}
                  style={{
                    backgroundColor:
                      resultColor === "red"
                        ? ROULETTE_COLORS.RED
                        : resultColor === "green"
                          ? ROULETTE_COLORS.GREEN
                          : ROULETTE_COLORS.BLACK,
                  }}
                >
                  <div className={styles.resultNumber}>
                    {resultNumber === null ? "—" : resultNumber}
                  </div>
                  <div className={styles.resultColor}>{resultColor ?? "—"}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.previousResults}>
          <ol className={styles.previousList}>
            {previousResults.length === 0 ? (
              <li className={styles.visuallyHidden}>No results yet.</li>
            ) : (
              previousResults.map((r, i) => (
                <li
                  className={`${styles.previousResult} ${r.color === "red" ? styles.colorRed : r.color === "green" ? styles.colorGreen : styles.colorBlack}`}
                  // biome-ignore lint/suspicious/noArrayIndexKey: index is fallback, number provides uniqueness
                  key={`${r.number}-${i}`}
                >
                  <span className={styles.previousNumber}>{r.number}</span>
                  <span>{r.color}</span>
                </li>
              ))
            )}
          </ol>
        </div>
      </div>
    </div>
  );
}
