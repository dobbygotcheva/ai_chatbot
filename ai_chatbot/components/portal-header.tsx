"use client";

import { ChevronDown, LogIn, LogOut, Moon, Plus, Sun } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { User } from "next-auth";
import { signOut, useSession } from "next-auth/react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { LanguageSelector, useLanguage } from "@/components/language-selector";
import { SidebarHistory } from "@/components/sidebar-history";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { t } from "@/lib/i18n";
import { DestinyLogo } from "./destiny-logo";

export function PortalHeader() {
  const router = useRouter();
  const { data: session, status: authStatus } = useSession();
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [isLeftPanelOpen, setIsLeftPanelOpen] = useState(false);
  const { lang } = useLanguage();

  const userDisplayName = (() => {
    const fullName = session?.user?.name?.trim();
    if (fullName) {
      return fullName;
    }

    const emailLocalPart = session?.user?.email?.split("@").at(0);
    if (!emailLocalPart) {
      return "User";
    }

    return emailLocalPart
      .split(/[._-]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  })();
  const normalizedEmail = session?.user?.email?.toLowerCase() ?? "";
  const resolvedUserDisplayName =
    normalizedEmail.includes("dobrinka") || /^dobrinka\b/i.test(userDisplayName)
      ? "Dobby Gotcheva"
      : userDisplayName;

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted ? resolvedTheme === "dark" : false;
  const sidebarUser = session?.user as User | undefined;

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-border/30 border-b bg-card/60 backdrop-blur-2xl backdrop-saturate-150">
        <div className="flex h-14 items-center justify-between px-4 lg:px-6">
          <div className="flex items-center gap-0.5">
            <Link
              className="flex items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-foreground no-underline outline-none focus-visible:outline-none"
              href="/"
            >
              <Image
                alt="EGT"
                className="size-8 shrink-0 rounded-lg"
                height={32}
                src="/images/egt-logo.png"
                width={32}
              />
              <span className="font-semibold text-[16px] text-foreground leading-tight tracking-[0.03em] md:text-[17px]">
                {t(lang, "header.ai_center_portal")}
              </span>
            </Link>
            <button
              aria-expanded={isLeftPanelOpen}
              aria-label={t(lang, "header.open_menu")}
              className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-lg text-muted-foreground/60 transition-transform duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border/60"
              onClick={() => setIsLeftPanelOpen((prev) => !prev)}
              type="button"
            >
              <ChevronDown
                className={`size-3.5 transition-transform duration-200 ${isLeftPanelOpen ? "rotate-180" : ""}`}
              />
            </button>
          </div>

          <div className="flex items-center gap-3">
            <div className="mr-1 flex flex-col items-end">
              <Link
                className="font-semibold text-[15px] text-foreground leading-tight tracking-[0.03em] no-underline outline-none focus-visible:outline-none md:text-[16px]"
                href="/"
              >
                {t(lang, "header.ai_center_portal")}
              </Link>
              <span className="font-medium text-[11px] text-muted-foreground/60 uppercase tracking-wider">
                EGT
              </span>
            </div>

            <div className="mx-0.5 h-6 w-px bg-border/40" />

            <LanguageSelector />

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  className="size-9 rounded-xl p-0 text-muted-foreground transition-all hover:bg-muted/60 hover:text-foreground"
                  onClick={() => setTheme(isDark ? "light" : "dark")}
                  type="button"
                  variant="ghost"
                >
                  {mounted ? (
                    isDark ? (
                      <Sun className="size-[18px]" />
                    ) : (
                      <Moon className="size-[18px]" />
                    )
                  ) : (
                    <span className="size-[18px]" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {isDark
                  ? t(lang, "header.light_mode")
                  : t(lang, "header.dark_mode")}
              </TooltipContent>
            </Tooltip>

            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <button
                  className="group flex h-9 cursor-pointer items-center gap-2 rounded-xl border border-border/40 pr-1.5 pl-2 transition-all hover:border-border hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border/60"
                  type="button"
                >
                  <Image
                    alt={t(lang, "header.account")}
                    className="size-6 object-contain"
                    height={24}
                    src="/images/user-circle.svg"
                    width={24}
                  />
                  <span className="hidden max-w-32 truncate font-medium text-[13px] text-foreground sm:inline">
                    {resolvedUserDisplayName}
                  </span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="min-w-[180px] rounded-xl border-border/40 p-1.5 shadow-xl"
                sideOffset={6}
              >
                {session?.user?.email && (
                  <>
                    <div className="px-3 py-2">
                      <p className="font-medium text-[14px] text-foreground">
                        {resolvedUserDisplayName}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {t(lang, "header.signed_in")}
                      </p>
                    </div>
                    <DropdownMenuSeparator className="my-1" />
                  </>
                )}
                {authStatus === "authenticated" ? (
                  <DropdownMenuItem
                    className="gap-2.5 rounded-lg px-3 py-2"
                    onSelect={async () => {
                      await signOut({ redirect: false });
                      window.location.assign("/login");
                    }}
                  >
                    <LogOut className="size-3.5 text-muted-foreground" />
                    <span className="text-[14px]">
                      {t(lang, "header.sign_out")}
                    </span>
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem
                    className="gap-2.5 rounded-lg px-3 py-2"
                    onSelect={() => router.push("/login")}
                  >
                    <LogIn className="size-3.5 text-muted-foreground" />
                    <span className="text-[14px]">
                      {t(lang, "header.sign_in")}
                    </span>
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>
      <aside
        className={`fixed top-14 left-0 z-40 h-[calc(100dvh-3.5rem)] w-[240px] border-border/40 border-r bg-card/60 p-3 backdrop-blur-2xl transition-transform duration-300 sm:w-[260px] ${
          isLeftPanelOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center gap-2 rounded-md px-2 pb-2">
            <DestinyLogo className="size-6 translate-y-0.5" />
            <p className="cursor-default font-semibold text-foreground text-lg">
              {t(lang, "sidebar.destiny")}
            </p>
          </div>
          <div className="mb-2 flex items-center justify-between px-2">
            <button
              className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-left font-medium text-[14px] text-foreground/90 transition-colors hover:bg-muted/60"
              onClick={() => {
                setIsLeftPanelOpen(false);
                router.push("/");
                router.refresh();
              }}
              type="button"
            >
              <Plus className="size-4 shrink-0 text-muted-foreground" />
              <span className="truncate">
                {t(lang, "header.new_conversation")}
              </span>
            </button>
            <button
              className="rounded-md px-2 py-1 text-muted-foreground text-xs transition-colors hover:bg-muted/60 hover:text-foreground"
              type="button"
            >
              More
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <SidebarHistory user={sidebarUser} />
          </div>
          <div className="pt-2">
            <Link
              className="mx-2 mb-2 flex items-center justify-center gap-2 rounded-xl border border-border/50 bg-card/60 px-4 py-2.5 font-medium text-foreground text-sm transition-all hover:bg-muted/70"
              href="/settings"
            >
              {t(lang, "header.settings")}
            </Link>
          </div>
        </div>
      </aside>
    </>
  );
}
