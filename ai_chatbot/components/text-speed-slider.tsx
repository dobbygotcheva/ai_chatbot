"use client";

import { Slider } from "@/components/ui/slider";
import { useTextSpeed } from "@/hooks/use-text-speed";

export function TextSpeedSlider() {
  const { speed, setSpeed } = useTextSpeed();

  return (
    <div className="flex items-center gap-2 px-2">
      <span className="font-medium text-muted-foreground text-xs">Slow</span>
      <Slider
        aria-label="Text streaming speed"
        className="w-32"
        max={100}
        min={0}
        onValueChange={(value) => setSpeed(value[0])}
        step={1}
        value={[speed]}
      />
      <span className="font-medium text-muted-foreground text-xs">Fast</span>
    </div>
  );
}
