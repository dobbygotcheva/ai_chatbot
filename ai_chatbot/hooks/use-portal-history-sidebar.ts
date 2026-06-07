"use client";

import type { Dispatch, SetStateAction } from "react";
import { useEffect } from "react";

/**
 * Routes where the portal left drawer should stay open on load. The drawer
 * is the user's gateway back to chats from these "utility" pages, so closing
 * it by default would leave them visually stranded.
 */
const OPEN_BY_DEFAULT_PREFIXES = ["/history", "/settings"] as const;

/**
 * Synchronous helper used to seed `useState` so the drawer renders in its
 * correct state on the very first paint — otherwise the useEffect below
 * would flip it from `false` to `true` one frame later, which looks like a
 * slide-in "jump" every time you switch between `/history` and `/settings`.
 */
export function isPortalSidebarOpenByDefault(pathname: string): boolean {
  return OPEN_BY_DEFAULT_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

/**
 * Keeps the portal drawer open on `/history` and `/settings`, and reopens
 * it when the user navigates between those routes client-side (the state
 * is preserved across pushes, so we only ever force it to `true` — we
 * never force it closed).
 */
export function usePortalHistorySidebarSync(
  pathname: string,
  setLeftPanelOpen: Dispatch<SetStateAction<boolean>>
) {
  useEffect(() => {
    if (isPortalSidebarOpenByDefault(pathname)) {
      setLeftPanelOpen(true);
    }
  }, [pathname, setLeftPanelOpen]);
}
