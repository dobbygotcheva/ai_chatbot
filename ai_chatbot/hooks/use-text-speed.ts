"use client";

import { useLocalStorage } from "usehooks-ts";

const TEXT_SPEED_STORAGE_KEY = "text-speed";

export function useTextSpeed() {
  const [sliderValue, setSliderValue] = useLocalStorage<number>(
    TEXT_SPEED_STORAGE_KEY,
    100
  );

  // Slider 100 = 0ms (instant), Slider 0 = 40ms/word (~25 words/sec)
  const delay = Math.round((100 - sliderValue) * 0.4);

  return {
    speed: sliderValue,
    setSpeed: setSliderValue,
    delay,
  };
}
