"use client";

import "@/app/cosmic-effects.css";
import {
  ChevronRight,
  ExternalLink,
  LogIn,
  LogOut,
  Moon,
  Plus,
  Search,
  Settings,
  Sun,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { User } from "next-auth";
import { signOut, useSession } from "next-auth/react";
import { useTheme } from "next-themes";
import { type MouseEvent, useEffect, useState } from "react";
import {
  ConfluenceProductIcon,
  JiraProductIcon,
} from "@/components/atlassian-product-icons";
import { GettingStartedDestinyIcon } from "@/components/getting-started-destiny-icon";
import { LanguageSelector, useLanguage } from "@/components/language-selector";
import { PortalHistorySidebarLink } from "@/components/portal-history-sidebar-link";
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
import {
  isPortalSidebarOpenByDefault,
  usePortalHistorySidebarSync,
} from "@/hooks/use-portal-history-sidebar";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function PortalTopHeader() {
  const { lang } = useLanguage();
  const pathname = usePathname();
  const router = useRouter();
  const { data: session, status: authStatus } = useSession();
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLeftPanelOpen, setIsLeftPanelOpen] = useState(() =>
    isPortalSidebarOpenByDefault(pathname)
  );
  const userDisplayName = (() => {
    const fullName = session?.user?.name?.trim();
    if (fullName) {
      return fullName;
    }
    const emailLocalPart = session?.user?.email?.split("@").at(0);
    if (!emailLocalPart) {
      return t(lang, "header.user");
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

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/chat?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    document.body.classList.toggle("portal-sidebar-open", isLeftPanelOpen);
    return () => {
      document.body.classList.remove("portal-sidebar-open");
    };
  }, [isLeftPanelOpen]);

  usePortalHistorySidebarSync(pathname, setIsLeftPanelOpen);

  const handleBackdropDismiss = () => {
    if (pathname === "/history") {
      return;
    }
    setIsLeftPanelOpen(false);
  };

  const isDark = mounted ? resolvedTheme === "dark" : false;
  const sidebarUser = session?.user as User | undefined;
  const isSettingsRoute =
    pathname === "/settings" || pathname?.startsWith("/settings/");

  const goToPortalHome = (e: MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    setIsLeftPanelOpen(false);
    window.dispatchEvent(new CustomEvent("portal-new-chat"));
    router.push("/");
    document
      .querySelector("[data-portal-main]")
      ?.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-50 border-neutral-200/90 border-b bg-white/80 shadow-[0_1px_0_0_rgba(0,0,0,0.04)] backdrop-blur-xl backdrop-saturate-150 dark:border-white/[0.07] dark:bg-white/[0.07] dark:shadow-none dark:backdrop-blur-2xl dark:backdrop-saturate-[1.6]">
        <div className="flex h-[var(--portal-header-height)] w-full items-center justify-between">
          {/* Left: same width + horizontal padding as sidebar (px-4 matches “New Chat” row) */}
          <div className="flex h-full w-[300px] shrink-0 items-center gap-2.5 px-4 md:gap-3">
            <button
              aria-label={
                isLeftPanelOpen
                  ? t(lang, "header.close_menu")
                  : t(lang, "header.open_menu")
              }
              className="portal-hamburger-shine group relative flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-border/60 bg-muted/50 text-foreground shadow-sm transition-[transform,box-shadow,background-color,border-color] hover:border-border hover:bg-muted hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border/60 active:scale-[0.97] dark:border-white/[0.14] dark:bg-white/[0.07] dark:hover:border-white/25 dark:hover:bg-white/[0.12]"
              onClick={() => setIsLeftPanelOpen((prev) => !prev)}
              type="button"
            >
              <span
                className={`absolute inset-0 z-[2] flex items-center justify-center transition-all duration-200 ${isLeftPanelOpen ? "rotate-90 opacity-0" : "rotate-0 opacity-100"}`}
              >
                <svg
                  aria-hidden
                  fill="none"
                  height="18"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                  width="18"
                >
                  <title>{t(lang, "header.open_menu")}</title>
                  <line x1="3" x2="21" y1="6" y2="6" />
                  <line x1="3" x2="21" y1="12" y2="12" />
                  <line x1="3" x2="21" y1="18" y2="18" />
                </svg>
              </span>
              <span
                className={`absolute inset-0 z-[2] flex items-center justify-center transition-all duration-200 ${isLeftPanelOpen ? "rotate-0 opacity-100" : "-rotate-90 opacity-0"}`}
              >
                <svg
                  aria-hidden
                  fill="none"
                  height="18"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                  width="18"
                >
                  <title>{t(lang, "header.close_menu")}</title>
                  <line x1="18" x2="6" y1="6" y2="18" />
                  <line x1="6" x2="18" y1="6" y2="18" />
                </svg>
              </span>
            </button>
            <Link
              className="flex min-w-0 flex-1 items-center gap-2.5 text-foreground/90 no-underline outline-none focus-visible:outline-none"
              href="/"
              onClick={goToPortalHome}
            >
              <Image
                alt="EGT"
                className="size-10 shrink-0 object-contain"
                height={40}
                src="/images/egt-logo.png"
                width={40}
              />
              <span className="hidden min-w-0 flex-1 whitespace-nowrap text-left font-semibold text-[16px] text-foreground/90 leading-tight tracking-[0.03em] sm:block md:text-[17px]">
                {t(lang, "header.ai_center_portal")}
              </span>
            </Link>
          </div>

          {/* Center spacer */}
          <div className="hidden min-w-0 flex-1 sm:block" />

          <div className="flex shrink-0 items-center gap-2 pr-4 md:gap-2.5 md:pr-6">
            <form className="hidden lg:block" onSubmit={handleSearch}>
              <div className="relative w-48 xl:w-56">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-primary/70" />
                <input
                  aria-label="Search"
                  className="h-9 w-full rounded-full border border-neutral-200/90 bg-white pr-3 pl-10 text-[13px] outline-none placeholder:text-foreground/55 focus:border-neutral-300 focus:bg-white focus:ring-2 focus:ring-black/[0.06] dark:border-white/[0.06] dark:bg-white/[0.04] dark:focus:bg-white/[0.08] dark:focus:ring-white/[0.06] dark:placeholder:text-muted-foreground"
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t(lang, "portal.search_placeholder")}
                  type="search"
                  value={searchQuery}
                />
              </div>
            </form>

            <div className="hidden sm:block">
              <LanguageSelector align="end" />
            </div>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  className="size-9 rounded-xl border border-neutral-200/80 bg-white p-0 text-foreground/65 transition-all hover:border-border hover:bg-neutral-50 hover:text-foreground hover:ring-1 hover:ring-border dark:border-white/[0.06] dark:bg-white/[0.04] dark:text-muted-foreground dark:hover:border-white/20 dark:hover:bg-white/[0.05] dark:hover:text-foreground dark:hover:ring-border"
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
                  className="flex cursor-pointer items-center gap-1.5 rounded-xl border border-neutral-200/80 bg-white px-2.5 py-1.5 transition-all hover:border-border hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border/60 dark:border-white/[0.06] dark:bg-white/[0.04] dark:hover:border-white/20 dark:hover:bg-white/[0.08]"
                  type="button"
                >
                  <Image
                    alt={t(lang, "header.account")}
                    className="size-6 object-contain"
                    height={24}
                    src="/images/user-circle.svg"
                    width={24}
                  />
                  <span className="max-w-32 truncate font-medium text-[13px] text-foreground">
                    {resolvedUserDisplayName}
                  </span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="min-w-[180px] rounded-2xl border-border/40 p-1.5 shadow-2xl"
                sideOffset={6}
              >
                {session?.user?.email && (
                  <>
                    <div className="px-3 py-2">
                      <p className="font-medium text-[13px] text-foreground">
                        {resolvedUserDisplayName}
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
                    <span className="text-[13px]">
                      {t(lang, "header.sign_out")}
                    </span>
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem
                    className="gap-2.5 rounded-lg px-3 py-2"
                    onSelect={() => router.push("/login")}
                  >
                    <LogIn className="size-3.5 text-muted-foreground" />
                    <span className="text-[13px]">
                      {t(lang, "header.sign_in")}
                    </span>
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {isLeftPanelOpen && (
        <div
          aria-hidden="true"
          className="fixed inset-0 z-30 sm:hidden"
          onClick={handleBackdropDismiss}
        />
      )}

      <aside
        className={`fixed top-[var(--portal-header-height)] bottom-[var(--portal-footer-height)] left-0 z-40 flex w-[340px] flex-col border-border border-r bg-background text-foreground shadow-[2px_0_20px_-4px_rgba(0,0,0,0.08)] transition-transform duration-300 [--sidebar-accent:var(--sidebar-accent-portal-light)] dark:text-neutral-100 dark:shadow-[2px_0_28px_-4px_rgba(0,0,0,0.45)] dark:[--sidebar-accent:var(--sidebar-accent-portal-dark)] ${
          mounted && isLeftPanelOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        data-portal-sidebar=""
      >
        {/* ── Scrollable area: New Chat + history ─────────────────── */}
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-3 pt-3">
          {/* New Chat button */}
          <button
            className="group mb-3 flex w-full cursor-pointer items-center gap-2.5 rounded-xl border border-foreground/[0.09] bg-foreground/[0.04] px-3.5 py-3 font-medium text-[14px] text-foreground/70 transition-all duration-150 hover:border-foreground/[0.16] hover:bg-foreground/[0.07] hover:text-foreground/90 active:scale-[0.97] active:opacity-80 dark:border-white/[0.09] dark:bg-white/[0.04] dark:text-neutral-100/60 dark:hover:border-white/[0.18] dark:hover:bg-white/[0.08] dark:hover:text-neutral-100/90"
            onClick={() => {
              setIsLeftPanelOpen(false);
              window.dispatchEvent(new CustomEvent("portal-new-chat"));
              router.push("/");
            }}
            type="button"
          >
            <Plus className="size-4 shrink-0" />
            <span className="flex-1 text-left">{t(lang, "chat.new_chat")}</span>
          </button>

          {/* Section label */}
          <p className="mb-0.5 px-1 font-bold text-[11px] text-foreground/45 uppercase tracking-widest dark:text-neutral-100/35">
            {t(lang, "sidebar.history")}
          </p>

          <div
            className="relative min-h-0 flex-1"
            data-sidebar="chat-history-scroll"
          >
            <SidebarHistory
              onClosePanel={() => setIsLeftPanelOpen(false)}
              portal
              user={sidebarUser}
            />
            {/* Fade to indicate more chats exist below */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-white/95 to-transparent dark:from-neutral-900/95 dark:to-transparent" />
          </div>
        </div>

        {/* ── Fixed bottom: featured + history link + settings ─────── */}
        <div className="shrink-0 px-3 pt-1 pb-3">
          {/* Gradient separator */}
          <div className="mb-3 h-px bg-gradient-to-r from-transparent via-foreground/[0.1] to-transparent dark:via-white/[0.1]" />

          {/* Full history link */}
          {sidebarUser ? (
            <div className="mb-3">
              <PortalHistorySidebarLink lang={lang} pathname={pathname} />
            </div>
          ) : null}

          {/* Featured Links — card */}
          <p className="mb-1.5 px-1 font-bold text-[11px] text-foreground/55 uppercase tracking-widest dark:text-neutral-100/45">
            {t(lang, "portal.featured")}
          </p>
          <div className="mb-3 overflow-hidden rounded-xl border border-foreground/[0.09] bg-foreground/[0.04] dark:border-white/[0.10] dark:bg-white/[0.05]">
            <Link
              className="group flex items-center gap-3 border-foreground/[0.07] border-b px-3.5 py-3 transition-all duration-150 hover:bg-foreground/[0.06] active:bg-foreground/[0.10] dark:border-white/[0.07] dark:active:bg-white/[0.11] dark:hover:bg-white/[0.07]"
              href="/"
              onClick={() => setIsLeftPanelOpen(false)}
            >
              <GettingStartedDestinyIcon className="size-[18px]" />
              <span className="min-w-0 flex-1 truncate font-medium text-[14px] text-foreground/85 transition-colors group-hover:text-foreground dark:text-neutral-100/80 dark:group-hover:text-neutral-100">
                {t(lang, "portal.featured.getting_started")}
              </span>
              <ChevronRight className="size-4 shrink-0 text-foreground/35 transition-all duration-150 group-hover:translate-x-0.5 group-hover:text-foreground/65 dark:text-neutral-100/30 dark:group-hover:text-neutral-100/60" />
            </Link>
            {[
              {
                label: t(lang, "portal.featured.jira"),
                icon: JiraProductIcon,
                href: "#",
              },
              {
                label: t(lang, "portal.featured.confluence"),
                icon: ConfluenceProductIcon,
                href: "#",
              },
            ].map(({ label, icon: Icon, href }, i, arr) => (
              <Link
                className={`group flex items-center gap-3 px-3.5 py-3 transition-all duration-150 hover:bg-foreground/[0.06] active:bg-foreground/[0.10] dark:active:bg-white/[0.11] dark:hover:bg-white/[0.07] ${
                  i < arr.length - 1
                    ? "border-foreground/[0.07] border-b dark:border-white/[0.07]"
                    : ""
                }`}
                href={href}
                key={label}
                onClick={() => setIsLeftPanelOpen(false)}
                rel="noopener noreferrer"
                target="_blank"
              >
                <Icon className="size-[18px] shrink-0 opacity-90" />
                <span className="min-w-0 flex-1 truncate font-medium text-[14px] text-foreground/85 transition-colors group-hover:text-foreground dark:text-neutral-100/80 dark:group-hover:text-neutral-100">
                  {label}
                </span>
                <ExternalLink className="size-3.5 shrink-0 text-foreground/30 transition-colors group-hover:text-foreground/60 dark:text-neutral-100/25 dark:group-hover:text-neutral-100/55" />
              </Link>
            ))}
          </div>

          {/* Settings — stays open because /settings is a keep-open route. */}
          <Link
            className={cn(
              "group flex w-full items-center justify-center gap-2 rounded-xl border border-black/10 bg-black/[0.05] px-3 py-3 font-medium text-[14px] text-black/70 transition-all duration-150 hover:border-black/20 hover:bg-black/[0.09] hover:text-black active:scale-[0.97] active:opacity-80 dark:border-white/10 dark:bg-white/[0.05] dark:text-white/70 dark:active:scale-[0.97] dark:active:opacity-80 dark:hover:border-white/20 dark:hover:bg-white/[0.09] dark:hover:text-white",
              isSettingsRoute &&
                "border-black/25 bg-black/[0.12] text-black ring-1 ring-black/40 hover:border-black/35 hover:bg-black/[0.16] hover:text-black dark:border-white/25 dark:bg-white/[0.12] dark:text-white dark:ring-white/40 dark:hover:border-white/35 dark:hover:bg-white/[0.16] dark:hover:text-white"
            )}
            href="/settings"
          >
            <Settings
              className={cn(
                "size-4 shrink-0 transition-transform duration-300 group-hover:rotate-180",
                isSettingsRoute
                  ? "text-black dark:text-white"
                  : "text-black/55 dark:text-white/55"
              )}
            />
            <span>{t(lang, "header.settings")}</span>
          </Link>
        </div>
      </aside>
    </>
  );
}
