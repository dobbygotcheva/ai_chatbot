/** Shared UI language (portal + settings). Safe to import from Server and Client Components. */

export const DEFAULT_UI_LANG = "bg";
export type UiLang = "en" | "bg";

export function normalizeUiLang(code: string | undefined): UiLang {
  if (code === "en" || code === "bg") {
    return code;
  }
  return DEFAULT_UI_LANG;
}
