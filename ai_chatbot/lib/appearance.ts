export const AURORAL_APPEARANCE_COOKIE = "auroral-appearance";

export const AURORAL_APPEARANCE_OPTIONS = [
  { value: "northern-intense", label: "Northern intense" },
  { value: "northern-dimmed", label: "Dimmed" },
  { value: "northern-dusk", label: "Dusk" },
  { value: "northern-warm", label: "Warm" },
  { value: "agrabah", label: "Agrabah" },
] as const;

export type AuroralAppearance =
  (typeof AURORAL_APPEARANCE_OPTIONS)[number]["value"];

export const DEFAULT_AURORAL_APPEARANCE: AuroralAppearance = "northern-warm";
