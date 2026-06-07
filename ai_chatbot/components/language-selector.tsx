"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  DEFAULT_UI_LANG,
  normalizeUiLang,
  type UiLang,
} from "@/lib/ui-language";

export {
  DEFAULT_UI_LANG as DEFAULT_LANG,
  normalizeUiLang,
  type UiLang,
} from "@/lib/ui-language";

const LANG_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

const LANGUAGES = [
  {
    code: "bg",
    label: "Български",
    short: "BG",
  },
  {
    code: "en",
    label: "English",
    short: "EN",
  },
] as const;

function BulgarianFlag() {
  return (
    <svg className="size-5 shrink-0 rounded-sm shadow-sm" viewBox="0 0 640 480">
      <title>Bulgarian</title>
      <rect fill="#fff" height="160" width="640" />
      <rect fill="#00966E" height="160" width="640" y="160" />
      <rect fill="#D62612" height="160" width="640" y="320" />
    </svg>
  );
}

function BritishFlag() {
  return (
    <svg className="size-5 shrink-0 rounded-sm shadow-sm" viewBox="0 0 640 480">
      <title>English</title>
      <rect fill="#012169" height="480" width="640" />
      <path
        d="M75 0l244 181L562 0h78v62L400 241l240 178v61h-80L320 301 81 480H0v-60l239-178L0 64V0h75z"
        fill="#fff"
      />
      <path
        d="M424 281l216 159v40L369 281h55zm-184 20l6 35L54 480H0l240-179zM640 0v3L391 191l2-44L590 0h50zM0 0l239 176h-60L0 42V0z"
        fill="#C8102E"
      />
      <path d="M241 0v480h160V0H241zM0 160v160h640V160H0z" fill="#fff" />
      <path d="M0 193v96h640v-96H0zM273 0v480h96V0h-96z" fill="#C8102E" />
    </svg>
  );
}

const FLAG_MAP: Record<string, () => React.JSX.Element> = {
  bg: BulgarianFlag,
  en: BritishFlag,
};

/* ── Context ── */

interface LanguageContextValue {
  lang: string;
  setLang: (code: string) => void;
}

const LanguageContext = createContext<LanguageContextValue>({
  lang: normalizeUiLang(undefined),
  setLang: () => {
    // Intentionally empty - no-op for default context
  },
});

function readLangCookie(): string {
  if (typeof document === "undefined") {
    return DEFAULT_UI_LANG;
  }
  const allCookies = document.cookie.split(";").map((c) => c.trim());
  const match = allCookies.find((c) => c.startsWith("ui-language="));
  if (match) {
    const val = match.split("=").at(1);
    if (val && LANGUAGES.some((l) => l.code === val)) {
      return val;
    }
  }
  return DEFAULT_UI_LANG;
}

function writeLangCookie(code: string) {
  // biome-ignore lint/suspicious/noDocumentCookie: client cookie
  document.cookie = `ui-language=${code}; path=/; max-age=${LANG_COOKIE_MAX_AGE}; SameSite=Lax`;
}

export function LanguageProvider({
  children,
  initialLang,
}: {
  children: React.ReactNode;
  /** From root layout `cookies()` so SSR matches the browser cookie on first paint. */
  initialLang?: string;
}) {
  const [lang, setLangState] = useState<UiLang>(() =>
    normalizeUiLang(initialLang)
  );

  useEffect(() => {
    const stored = readLangCookie();
    setLangState(normalizeUiLang(stored));
    if (stored !== readLangCookie()) {
      writeLangCookie(stored);
    }
  }, []);

  const setLang = useCallback((code: string) => {
    const next = normalizeUiLang(code);
    setLangState(next);
    writeLangCookie(next);
  }, []);

  const value = useMemo(() => ({ lang, setLang }), [lang, setLang]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}

export { t as translate } from "@/lib/i18n";

/* ── Selector component ── */

export function LanguageSelector({
  align = "end",
}: {
  align?: "start" | "end";
}) {
  const { lang, setLang } = useLanguage();
  const current = LANGUAGES.find((l) => l.code === lang) ?? LANGUAGES[0];
  const FlagComponent = FLAG_MAP[current.code] ?? BulgarianFlag;

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          className="flex cursor-pointer items-center gap-1.5 text-foreground focus-visible:outline-none"
          type="button"
        >
          <FlagComponent />
          <span className="font-semibold text-[11px] tracking-wide">
            {current.short}
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align={align}
        className="min-w-[160px]"
        sideOffset={8}
      >
        {LANGUAGES.map((l) => {
          const Flag = FLAG_MAP[l.code] ?? BulgarianFlag;
          return (
            <DropdownMenuItem
              className={`gap-3 rounded-lg px-3 py-2.5 text-foreground focus:text-foreground ${
                lang === l.code
                  ? "bg-primary/10 text-primary focus:text-primary"
                  : ""
              }`}
              key={l.code}
              onSelect={() => setLang(l.code)}
            >
              <Flag />
              <span className="font-medium text-sm">{l.label}</span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export { LANGUAGES };
