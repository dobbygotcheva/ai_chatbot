"use client";

import "@/app/anim_bg_gradients/auroral-master/auroral-master/css/auroral.css";

export const AURORAL_VARIANTS = [
  "northern",
  "northern-intense",
  "northern-dimmed",
  "northern-dusk",
  "northern-warm",
  "agrabah",
] as const;

export type AuroralVariant = (typeof AURORAL_VARIANTS)[number];

type AuroralBackgroundProps = {
  variant?: AuroralVariant;
  className?: string;
};

export function AuroralBackground({
  variant = "northern-warm",
  className = "",
}: AuroralBackgroundProps) {
  const auroralClass = `auroral-${variant}`;

  return (
    <div aria-hidden className={`overflow-hidden ${className}`.trim()}>
      <div className={auroralClass} />
    </div>
  );
}
