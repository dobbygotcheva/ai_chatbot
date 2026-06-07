"use client";

import { Moon, Sun } from "lucide-react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { LanguageSelector, useLanguage } from "@/components/language-selector";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { t } from "@/lib/i18n";

export default function Page() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");
  const rawCallback = searchParams.get("callbackUrl") ?? "/";
  const callbackUrl = rawCallback.includes("/auth/error")
    ? "/"
    : rawCallback.startsWith("/") && !rawCallback.startsWith("//")
      ? rawCallback
      : "/";

  const { lang } = useLanguage();
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [showError, setShowError] = useState(
    !!error || rawCallback.includes("/auth/error")
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleM365SignIn = async () => {
    setIsSigningIn(true);
    setShowError(false);
    await signIn("azure-ad", { callbackUrl });
  };

  const isDark = mounted ? resolvedTheme === "dark" : false;

  return (
    <TooltipProvider delayDuration={0}>
      <div className="relative flex min-h-dvh flex-col bg-background">
        <header className="flex h-14 shrink-0 items-center justify-end gap-3 border-border/30 border-b bg-background/95 px-4 backdrop-blur-md md:px-6">
          <LanguageSelector align="end" />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                className="size-9 rounded-lg p-0 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
                onClick={() => setTheme(isDark ? "light" : "dark")}
                type="button"
                variant="ghost"
              >
                {mounted ? (
                  isDark ? (
                    <Sun className="size-[17px]" />
                  ) : (
                    <Moon className="size-[17px]" />
                  )
                ) : (
                  <span className="size-[17px]" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent sideOffset={6}>
              {isDark
                ? t(lang, "header.light_mode")
                : t(lang, "header.dark_mode")}
            </TooltipContent>
          </Tooltip>
        </header>

        <div className="relative flex flex-1 flex-col items-center justify-center overflow-hidden px-5 py-8">
          <div
            aria-hidden="true"
            className="auth-login-radial-glow pointer-events-none absolute inset-0"
          />

          <div className="relative z-10 flex w-full max-w-[420px] flex-col items-center">
            <div className="auth-login-card flex w-full flex-col gap-7 rounded-2xl px-7 pt-8 pb-7 sm:px-10 sm:pt-10 sm:pb-10">
              <div className="flex flex-col items-center gap-2.5">
                <Image
                  alt="EGT"
                  className="size-16 object-contain"
                  height={64}
                  priority
                  src="/images/egt-logo.png"
                  width={64}
                />
                <div className="flex flex-col items-center gap-0.5">
                  <span className="select-none font-bold text-foreground text-lg tracking-widest">
                    {t(lang, "login.ai_center")}
                  </span>
                  <p className="font-medium text-[11px] text-muted-foreground uppercase tracking-[0.2em]">
                    {t(lang, "login.egt_digital")}
                  </p>
                </div>
              </div>

              <div className="auth-login-form flex flex-col gap-4">
                {showError && (
                  <div className="rounded-lg bg-destructive/10 p-3 text-destructive text-sm">
                    <p className="font-semibold">Access Denied</p>
                    <p className="text-xs opacity-80">
                      Your account doesn't have permission to access this
                      environment.
                    </p>
                  </div>
                )}
                <button
                  className="w-full cursor-pointer rounded-[10px] bg-[#0078D4] py-3 font-semibold text-[0.9rem] text-white tracking-wide transition-all hover:bg-[#106ebe] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0078D4]/50 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={isSigningIn}
                  id="m365-login-button"
                  onClick={handleM365SignIn}
                  type="button"
                >
                  {isSigningIn
                    ? t(lang, "login.signing_in")
                    : t(lang, "login.sign_in_with_m365")}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
