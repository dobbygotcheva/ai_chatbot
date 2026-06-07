"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import type { AuroralAppearance } from "@/lib/appearance";
import {
  AURORAL_APPEARANCE_COOKIE,
  DEFAULT_AURORAL_APPEARANCE,
} from "@/lib/appearance";

type AppearanceContextValue = {
  appearance: AuroralAppearance;
  setAppearance: (value: AuroralAppearance) => void;
};

const AppearanceContext = createContext<AppearanceContextValue | null>(null);

const COOKIE_MAX_AGE = 365 * 24 * 60 * 60;

function setAppearanceCookie(value: AuroralAppearance) {
  if (typeof document === "undefined") {
    return;
  }

  // biome-ignore lint/suspicious/noDocumentCookie: Standard Web API for cookies
  document.cookie = `${AURORAL_APPEARANCE_COOKIE}=${value}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`;
}

export function AppearanceProvider({
  children,
  initialAppearance = DEFAULT_AURORAL_APPEARANCE,
}: {
  children: React.ReactNode;
  initialAppearance?: AuroralAppearance;
}) {
  const [appearance, setAppearanceState] =
    useState<AuroralAppearance>(initialAppearance);

  const setAppearance = useCallback((value: AuroralAppearance) => {
    setAppearanceState(value);
    setAppearanceCookie(value);
  }, []);

  const value = useMemo<AppearanceContextValue>(
    () => ({ appearance, setAppearance }),
    [appearance, setAppearance]
  );

  return (
    <AppearanceContext.Provider value={value}>
      <div className="min-h-dvh" data-auroral={appearance}>
        {children}
      </div>
    </AppearanceContext.Provider>
  );
}

export function useAppearance(): AppearanceContextValue {
  const ctx = useContext(AppearanceContext);
  if (!ctx) {
    throw new Error("useAppearance must be used within AppearanceProvider");
  }
  return ctx;
}
