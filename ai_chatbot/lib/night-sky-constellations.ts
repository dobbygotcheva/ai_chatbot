/**
 * Decorative night-sky asterisms (no connecting lines). IAU lists 88 constellations;
 * we render a subset as bright-star dot patterns spread across the viewport.
 *
 * See: https://www.iau.org/public/themes/constellations/ (full list of names / abbreviations).
 */

export type ViewportRegion = {
  /** Left edge % (0–100). */
  left: number;
  /** Top edge % (0–100). */
  top: number;
  /** Width % of viewport. */
  width: number;
  /** Height % of viewport. */
  height: number;
};

/** Spectral / color hints for glow (simplified). */
export type StarKind =
  | "betelgeuse"
  | "rigel"
  | "bellatrix"
  | "meissa"
  | "belt"
  | "sword"
  | "saiph"
  | "blue_bright"
  | "blue"
  | "white"
  | "yellow"
  | "orange"
  | "red_giant"
  | "cyan";

export type TemplateStar = {
  lx: number;
  ly: number;
  flux: number;
  kind: StarKind;
};

export type ConstellationTemplate = {
  id: string;
  abbrev: string;
  englishName: string;
  region: ViewportRegion;
  stars: TemplateStar[];
};

const HSL: Record<StarKind, { h: number; s: number; l: number }> = {
  betelgeuse: { h: 20, s: 78, l: 58 },
  rigel: { h: 212, s: 46, l: 91 },
  bellatrix: { h: 0, s: 0, l: 93 },
  meissa: { h: 210, s: 28, l: 88 },
  belt: { h: 205, s: 22, l: 90 },
  sword: { h: 202, s: 26, l: 87 },
  saiph: { h: 218, s: 38, l: 78 },
  blue_bright: { h: 210, s: 52, l: 92 },
  blue: { h: 208, s: 38, l: 88 },
  white: { h: 0, s: 0, l: 92 },
  yellow: { h: 48, s: 58, l: 88 },
  orange: { h: 28, s: 72, l: 62 },
  red_giant: { h: 14, s: 68, l: 58 },
  cyan: { h: 195, s: 42, l: 88 },
};

export function mapStarToViewport(
  lx: number,
  ly: number,
  region: ViewportRegion
): { left: number; top: number } {
  return {
    left: region.left + (lx / 100) * region.width,
    top: region.top + (ly / 100) * region.height,
  };
}

export type ConstellationStarStyle = {
  background: string;
  boxShadow: string;
  opacity: number;
  sizePx: number;
};

function haloRgb(kind: StarKind): { r: number; g: number; b: number } {
  if (kind === "betelgeuse" || kind === "orange" || kind === "red_giant") {
    return { r: 255, g: 205, b: 175 };
  }
  if (kind === "yellow") {
    return { r: 255, g: 230, b: 190 };
  }
  return { r: 188, g: 210, b: 255 };
}

export function buildConstellationStarStyle(
  star: TemplateStar,
  isDark: boolean
): ConstellationStarStyle {
  const { flux, kind } = star;
  const { h, s, l } = HSL[kind];
  const background = s === 0 ? `hsl(0 0% ${l}%)` : `hsl(${h} ${s}% ${l}%)`;

  const big =
    kind === "betelgeuse" ||
    kind === "rigel" ||
    kind === "blue_bright" ||
    kind === "orange";
  const sizePx = (0.36 + flux * 1.26) * (big ? 1.08 : 1);

  if (!isDark) {
    const opacity = 0.13 + flux * 0.21;
    const pin = 0.13 + flux * 0.22;
    const bloom = 0.039 + flux * 0.09;
    const halo = 0.021 + flux * 0.052;
    const boxShadow = [
      `0 0 0.45px 0.32px hsl(${h} ${Math.max(s, 8)}% ${l + 5}% / ${pin.toFixed(3)})`,
      `0 0 1px 0.48px hsl(${h} ${s}% ${l}% / ${bloom.toFixed(3)})`,
      `0 0 2.2px 0.82px hsl(220 28% 58% / ${halo.toFixed(3)})`,
    ].join(", ");
    return { background, boxShadow, opacity, sizePx };
  }

  const { r, g, b } = haloRgb(kind);
  const opacity = 0.235 + flux * 0.5;
  const pin = 0.295 + flux * 0.58;
  const bloom = 0.058 + flux * 0.135;
  const haloA = 0.029 + flux * 0.084;
  const haloSpread = 2.05 + flux * 1.85;

  const layers = [
    `0 0 0.4px 0.28px rgba(255,255,255,${(pin * 0.93).toFixed(3)})`,
    `0 0 1.02px 0.5px rgba(255,255,255,${bloom.toFixed(3)})`,
    `0 0 ${haloSpread.toFixed(2)}px 1px rgba(${r},${g},${b},${haloA.toFixed(3)})`,
  ];

  if (flux > 0.74) {
    layers.push(
      `0 0 ${(haloSpread + 1.9).toFixed(2)}px 1.5px rgba(${r},${g},${b},${(haloA * 0.4).toFixed(3)})`
    );
  }

  return {
    background,
    boxShadow: layers.join(", "),
    opacity,
    sizePx,
  };
}

/** Non-overlapping viewport patches; local (lx,ly) in 0–100 per asterism. */
export const NIGHT_SKY_CONSTELLATIONS: ConstellationTemplate[] = [
  {
    id: "cas",
    abbrev: "Cas",
    englishName: "Cassiopeia",
    region: { left: 2, top: 4, width: 20, height: 18 },
    stars: [
      { lx: 12, ly: 22, flux: 0.58, kind: "white" },
      { lx: 35, ly: 48, flux: 0.64, kind: "white" },
      { lx: 50, ly: 58, flux: 0.6, kind: "white" },
      { lx: 65, ly: 48, flux: 0.64, kind: "white" },
      { lx: 88, ly: 24, flux: 0.58, kind: "white" },
    ],
  },
  {
    id: "uma",
    abbrev: "UMa",
    englishName: "Ursa Major",
    region: { left: 74, top: 6, width: 22, height: 24 },
    stars: [
      { lx: 18, ly: 72, flux: 0.78, kind: "yellow" },
      { lx: 42, ly: 76, flux: 0.72, kind: "white" },
      { lx: 40, ly: 52, flux: 0.7, kind: "white" },
      { lx: 52, ly: 45, flux: 0.76, kind: "white" },
      { lx: 64, ly: 40, flux: 0.86, kind: "blue_bright" },
      { lx: 76, ly: 34, flux: 0.72, kind: "white" },
      { lx: 90, ly: 20, flux: 0.74, kind: "white" },
    ],
  },
  {
    id: "cyg",
    abbrev: "Cyg",
    englishName: "Cygnus",
    region: { left: 3, top: 26, width: 14, height: 20 },
    stars: [
      { lx: 50, ly: 8, flux: 0.88, kind: "blue_bright" },
      { lx: 32, ly: 48, flux: 0.58, kind: "white" },
      { lx: 50, ly: 50, flux: 0.72, kind: "white" },
      { lx: 68, ly: 48, flux: 0.58, kind: "white" },
      { lx: 50, ly: 90, flux: 0.64, kind: "white" },
    ],
  },
  {
    id: "ori",
    abbrev: "Ori",
    englishName: "Orion",
    region: { left: 28, top: 34, width: 44, height: 40 },
    stars: [
      { lx: 50, ly: 9, flux: 0.52, kind: "meissa" },
      { lx: 27, ly: 27, flux: 0.9, kind: "betelgeuse" },
      { lx: 73, ly: 26, flux: 0.64, kind: "bellatrix" },
      { lx: 40, ly: 51, flux: 0.72, kind: "belt" },
      { lx: 50, ly: 52, flux: 0.78, kind: "belt" },
      { lx: 60, ly: 51, flux: 0.7, kind: "belt" },
      { lx: 50, ly: 64, flux: 0.58, kind: "sword" },
      { lx: 27, ly: 83, flux: 0.94, kind: "rigel" },
      { lx: 70, ly: 82, flux: 0.66, kind: "saiph" },
    ],
  },
  {
    id: "gem",
    abbrev: "Gem",
    englishName: "Gemini",
    region: { left: 72, top: 8, width: 24, height: 16 },
    stars: [
      { lx: 22, ly: 48, flux: 0.82, kind: "white" },
      { lx: 78, ly: 48, flux: 0.88, kind: "yellow" },
      { lx: 35, ly: 72, flux: 0.52, kind: "white" },
      { lx: 50, ly: 68, flux: 0.5, kind: "white" },
      { lx: 65, ly: 72, flux: 0.52, kind: "white" },
      { lx: 50, ly: 28, flux: 0.48, kind: "white" },
    ],
  },
  {
    id: "tau",
    abbrev: "Tau",
    englishName: "Taurus",
    region: { left: 6, top: 48, width: 20, height: 18 },
    stars: [
      { lx: 45, ly: 55, flux: 0.9, kind: "orange" },
      { lx: 22, ly: 38, flux: 0.55, kind: "white" },
      { lx: 35, ly: 32, flux: 0.52, kind: "white" },
      { lx: 55, ly: 32, flux: 0.52, kind: "white" },
      { lx: 68, ly: 38, flux: 0.55, kind: "white" },
    ],
  },
  {
    id: "cma",
    abbrev: "CMa",
    englishName: "Canis Major",
    region: { left: 43, top: 74, width: 14, height: 14 },
    stars: [
      { lx: 50, ly: 28, flux: 0.98, kind: "blue_bright" },
      { lx: 28, ly: 62, flux: 0.58, kind: "white" },
      { lx: 72, ly: 62, flux: 0.58, kind: "white" },
      { lx: 50, ly: 82, flux: 0.52, kind: "white" },
    ],
  },
  {
    id: "lyr",
    abbrev: "Lyr",
    englishName: "Lyra",
    region: { left: 84, top: 30, width: 14, height: 16 },
    stars: [
      { lx: 35, ly: 25, flux: 0.94, kind: "blue_bright" },
      { lx: 18, ly: 55, flux: 0.55, kind: "white" },
      { lx: 55, ly: 52, flux: 0.56, kind: "white" },
      { lx: 72, ly: 58, flux: 0.52, kind: "white" },
      { lx: 48, ly: 78, flux: 0.5, kind: "white" },
    ],
  },
  {
    id: "sco",
    abbrev: "Sco",
    englishName: "Scorpius",
    region: { left: 6, top: 78, width: 26, height: 18 },
    stars: [
      { lx: 18, ly: 18, flux: 0.55, kind: "white" },
      { lx: 35, ly: 32, flux: 0.62, kind: "white" },
      { lx: 48, ly: 48, flux: 0.92, kind: "orange" },
      { lx: 55, ly: 62, flux: 0.65, kind: "white" },
      { lx: 62, ly: 76, flux: 0.58, kind: "white" },
      { lx: 72, ly: 86, flux: 0.54, kind: "white" },
      { lx: 82, ly: 92, flux: 0.5, kind: "white" },
    ],
  },
  {
    id: "leo",
    abbrev: "Leo",
    englishName: "Leo",
    region: { left: 68, top: 76, width: 26, height: 18 },
    stars: [
      { lx: 78, ly: 22, flux: 0.88, kind: "blue_bright" },
      { lx: 42, ly: 35, flux: 0.62, kind: "white" },
      { lx: 28, ly: 48, flux: 0.58, kind: "white" },
      { lx: 38, ly: 62, flux: 0.6, kind: "white" },
      { lx: 52, ly: 55, flux: 0.58, kind: "yellow" },
      { lx: 22, ly: 72, flux: 0.56, kind: "white" },
      { lx: 55, ly: 78, flux: 0.55, kind: "white" },
    ],
  },
];

export const NIGHT_SKY_TEMPLATE_STAR_COUNT = NIGHT_SKY_CONSTELLATIONS.reduce(
  (n, c) => n + c.stars.length,
  0
);
