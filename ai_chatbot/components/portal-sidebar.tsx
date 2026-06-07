"use client";

import { Moon, Plus, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { useLanguage } from "@/components/language-selector";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { DestinyLogo } from "./destiny-logo";

export function PortalSidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const { lang } = useLanguage();

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted ? resolvedTheme === "dark" : false;
  const isSettingsRoute =
    pathname === "/settings" || pathname?.startsWith("/settings/");

  return (
    <Sidebar className="group-data-[side=left]:border-r-0">
      <SidebarHeader>
        <SidebarMenu>
          <div className="flex flex-col gap-0.5 px-2 py-2">
            {/* biome-ignore lint/performance/noImgElement: static asset */}
            {/* biome-ignore lint/correctness/useImageSize: sized by parent */}
            <img
              alt="EGT"
              className="size-10 shrink-0 rounded-lg object-cover"
              src="/images/egt-logo.png"
            />
            <p className="font-semibold text-[14px] text-white">
              {t(lang, "portal.sidebar.ai_portal")}
            </p>
            <p className="font-medium text-[13px] text-white/55">
              {t(lang, "portal.sidebar.egt_digital")}
            </p>
          </div>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  className="gap-2.5 rounded-full bg-primary px-3 py-2 font-semibold text-[14px] text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground"
                >
                  <Link href="/">
                    <DestinyLogo className="size-5 text-primary-foreground" />
                    <span>{t(lang, "sidebar.destiny")}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  className="group gap-2.5 font-medium text-[14px] text-white/80 hover:bg-white/[0.06] hover:text-white"
                  onClick={() => {
                    router.push("/");
                    router.refresh();
                  }}
                  type="button"
                >
                  <Plus className="size-4 shrink-0 text-white/60 transition-colors group-hover:text-white" />
                  <span className="truncate text-left">
                    {t(lang, "header.new_conversation")}
                  </span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="font-semibold text-[11px] text-white/40 uppercase tracking-wider">
            {t(lang, "header.resources")}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  className="gap-2.5 font-medium text-[14px] text-white/80 hover:bg-white/[0.06] hover:text-white"
                >
                  <Link href="/changelog">{t(lang, "sidebar.changelog")}</Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  className="gap-2.5 font-medium text-[14px] text-white/80 hover:bg-white/[0.06] hover:text-white"
                >
                  <Link href="#">{t(lang, "sidebar.blog")}</Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  className="gap-2.5 font-medium text-[14px] text-white/80 hover:bg-white/[0.06] hover:text-white"
                >
                  <Link href="#">{t(lang, "header.contact")}</Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              className="group gap-2.5 font-medium text-[14px] text-white/80 hover:bg-white/[0.06] hover:text-white"
              onClick={() => setTheme(isDark ? "light" : "dark")}
              type="button"
            >
              <Moon className="size-4 shrink-0 text-white/60 transition-colors group-hover:text-white" />
              <span>
                {isDark
                  ? t(lang, "header.light_mode")
                  : t(lang, "header.dark_mode")}
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className={cn(
                "group flex w-full items-center justify-center gap-2 rounded-xl border border-black/10 bg-black/[0.05] px-3 py-3 font-medium text-[14px] text-black/70 transition-all duration-150 hover:border-black/20 hover:bg-black/[0.09] hover:text-black active:scale-[0.97] active:opacity-80 dark:border-white/10 dark:bg-white/[0.05] dark:text-white/70 dark:active:scale-[0.97] dark:active:opacity-80 dark:hover:border-white/20 dark:hover:bg-white/[0.09] dark:hover:text-white",
                isSettingsRoute &&
                  "border-black/25 bg-black/[0.12] text-black ring-1 ring-black/40 hover:border-black/35 hover:bg-black/[0.16] hover:text-black dark:border-white/25 dark:bg-white/[0.12] dark:text-white dark:ring-white/40 dark:hover:border-white/35 dark:hover:bg-white/[0.16] dark:hover:text-white"
              )}
            >
              <Link href="/settings">
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
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
