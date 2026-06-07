/**
 * Shared scenario tab + suggestion chip styles (portal + chat) so they stay in sync.
 * Light-mode glass fill/border: `--chrome-glass-surface-light` in `app/palette.css` (same as sidebar / .input-pane).
 */

/**
 * Border / fill / shadow shared by suggestion chips, composer, and disclaimers.
 * Light: solid white (no blur — avoids cream bleed).
 * Dark: solid opaque background-color (not a gradient over white) so transitions into
 * the active/brand state animate dark→red cleanly with no white flash. Depth comes
 * from the inset top highlight + layered outer shadow.
 */
export const SUGGESTION_CHIP_SURFACE =
  "rounded-2xl border border-neutral-200/80 bg-chrome-glass-surface-light shadow-[0_1px_2px_rgba(0,0,0,0.04),0_6px_22px_-10px_rgba(0,0,0,0.08)] dark:border-white/[0.08] dark:bg-[hsl(0_0%_12%)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_1px_2px_rgba(0,0,0,0.35),0_10px_30px_-14px_rgba(0,0,0,0.6)]";

/** Disclaimers and other panels — match suggestion chip white */
export const CHROME_GLASS_PANEL = SUGGESTION_CHIP_SURFACE;

/**
 * Chat composer backdrop — elevated white card (portal + /chat).
 * Stronger than chips so the input reads as the primary surface.
 */
export const CHROME_GLASS_INPUT =
  "rounded-3xl border border-neutral-200/85 bg-white shadow-[0_4px_28px_-10px_rgba(0,0,0,0.09),0_0_0_1px_rgba(0,0,0,0.025)_inset] dark:border-white/[0.1] dark:bg-white/[0.07] dark:shadow-[0_12px_44px_-18px_rgba(0,0,0,0.55)] dark:backdrop-blur-xl dark:backdrop-saturate-150";

/** Bottom toolbar strip inside the composer — subtle separation from the textarea */
export const COMPOSER_TOOLBAR =
  "border-t border-neutral-100/95 bg-neutral-50/70 dark:border-white/[0.08] dark:bg-black/[0.12]";

/** Shell shared by every scenario tab (Write, Think, Create, Code, Improve, Plan). */
export const SCENARIO_TAB_SHELL =
  "flex h-11 min-h-[2.75rem] w-full min-w-0 cursor-pointer items-center justify-center rounded-2xl border px-1.5 py-2 font-semibold text-[11px] leading-none tracking-tight transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25 focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:px-3 sm:text-sm dark:focus-visible:ring-offset-background";

/** Icon + label as one centered cluster inside the tab. */
export const SCENARIO_TAB_CONTENT =
  "inline-flex max-w-full items-center justify-center gap-1 sm:gap-1.5";

export const SCENARIO_TAB_LABEL =
  "min-w-0 max-w-full truncate text-center leading-none";

export const SCENARIO_TAB_ACTIVE =
  "border-primary bg-primary text-primary-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_1px_6px_-3px_rgb(var(--brand-rgb)_/_0.28)] hover:bg-primary/94 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.26),0_2px_12px_-4px_rgb(var(--brand-rgb)_/_0.38)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_2px_10px_-3px_rgb(var(--brand-rgb)_/_0.45)] dark:hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_4px_16px_-4px_rgb(var(--brand-rgb)_/_0.55)]";

/**
 * Inactive tab.
 *
 * Light mode mirrors `.suggestion-pane` (the starter suggestion chips): a
 * visible hairline border + layered drop-shadow so the tab lifts off the
 * off-white canvas the same way scenarios already do in dark mode.
 *
 * Dark mode keeps the existing fully opaque elevated pill:
 *   • solid dark background-color so inactive→active animates dark→red (no white flicker)
 *   • hairline white/[0.07] border + inset top highlight fakes a subtle top-to-bottom sheen
 *   • soft outer shadow for elevation over the chat scroll
 *   • hover brightens the fill and tints the border/text toward brand
 */
export const SCENARIO_TAB_INACTIVE =
  "border border-neutral-200/80 bg-chrome-glass-surface-light text-foreground/58 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_6px_22px_-10px_rgba(0,0,0,0.08)] hover:border-primary/25 hover:bg-chrome-glass-surface-light hover:text-foreground/88 hover:shadow-[0_2px_4px_rgba(0,0,0,0.05),0_8px_24px_-10px_rgba(0,0,0,0.1)] dark:border-white/[0.07] dark:bg-[hsl(0_0%_13%)] dark:text-white/70 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_1px_2px_rgba(0,0,0,0.35),0_6px_18px_-10px_rgba(0,0,0,0.55)] dark:hover:border-primary/45 dark:hover:bg-[hsl(0_0%_16%)] dark:hover:text-white/95 dark:hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_2px_4px_rgba(0,0,0,0.4),0_10px_28px_-10px_rgba(0,0,0,0.6)]";

/**
 * Suggestion chips under the active scenario (all scenarios use the same look).
 *
 * Light mode mirrors `.suggestion-pane` (the starter suggestion chips on the
 * empty state) so scenario chips and the four starter suggestions share the
 * exact same visual register: visible neutral hairline border + layered drop
 * shadow, so the card lifts off the off-white canvas — the same way it already
 * does in dark mode.
 *
 * Dark mode keeps the existing "pressable card" feel — brighter solid fill on
 * hover with a brand-tinted inner ring + deeper elevation, no white flicker on
 * click.
 */
export const SCENARIO_SUGGESTION_BUTTON =
  "group relative flex min-h-[3.5rem] w-full cursor-pointer items-center justify-center overflow-hidden rounded-2xl px-4 py-3 transition-all duration-200 " +
  // Light mode — matches `.suggestion-pane` (SUGGESTION_CHIP_SURFACE) so it
  // lifts off the canvas the same way the starter suggestion chips do.
  "border border-neutral-200/80 bg-chrome-glass-surface-light shadow-[0_1px_2px_rgba(0,0,0,0.04),0_6px_22px_-10px_rgba(0,0,0,0.08)] " +
  "hover:border-primary/25 hover:bg-chrome-glass-surface-light hover:shadow-[0_2px_4px_rgba(0,0,0,0.05),0_10px_28px_-12px_rgba(0,0,0,0.12)] motion-safe:hover:-translate-y-[1px] active:translate-y-0 active:shadow-none " +
  // Dark mode — preserve the existing elevated chip styling
  "dark:border-white/[0.08] dark:bg-[hsl(0_0%_12%)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_1px_2px_rgba(0,0,0,0.35),0_10px_30px_-14px_rgba(0,0,0,0.6)] " +
  "dark:hover:border-primary/35 dark:hover:bg-[hsl(0_0%_15%)] dark:hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.07),inset_0_0_0_1px_rgba(var(--brand-rgb),0.12),0_12px_32px_-12px_rgba(0,0,0,0.65)] motion-safe:dark:hover:-translate-y-[2px] dark:active:translate-y-0 " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/32 focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:focus-visible:ring-offset-background";

/** Inner wrapper — icon left, label right, row centered in card. */
export const SCENARIO_SUGGESTION_INNER =
  "inline-flex min-w-0 max-w-full items-center justify-center gap-2.5";

/** Kept for backward compat, not rendered */
export const SCENARIO_SUGGESTION_INDEX = "";

export const SCENARIO_SUGGESTION_ICON =
  "size-[1.1rem] shrink-0 text-primary/60 transition-colors duration-200 group-hover:text-primary dark:text-primary/50 dark:group-hover:text-primary/90";

export const SCENARIO_SUGGESTION_LABEL =
  "min-w-0 text-pretty font-semibold text-foreground/90 text-[13px] leading-snug tracking-tight dark:text-white/94";

export const SCENARIO_SUGGESTION_SUBTEXT =
  "max-w-[22ch] text-balance text-[11px] text-foreground/52 leading-snug dark:text-white/52";
