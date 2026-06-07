"use client";

import { BookOpen, FileText, MessageCircle } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { APP_VERSION } from "@/lib/app-version";
import { t } from "@/lib/i18n";
import { useLanguage } from "./language-selector";

export function PortalFooter() {
  const { lang } = useLanguage();

  return (
    <footer
      className="relative z-10 flex h-[var(--portal-footer-height)] w-full shrink-0 items-center border-neutral-200/90 border-t bg-white/80 font-normal font-sans text-[13px] text-foreground/65 shadow-[0_-1px_0_0_rgba(0,0,0,0.03)] backdrop-blur-xl backdrop-saturate-150 dark:border-white/[0.07] dark:bg-white/[0.06] dark:text-white/65 dark:shadow-none dark:backdrop-blur-xl"
      data-portal-footer=""
    >
      <div className="flex h-full w-full items-center justify-between gap-3 px-3 pr-5 pl-3 md:pr-8 md:pl-5">
        <div className="flex items-center gap-2">
          {/* biome-ignore lint: using static logo image */}
          <img
            alt="EGT"
            className="size-6 shrink-0 opacity-75"
            src="/images/egt-logo.png"
          />
          <div className="flex min-w-0 flex-col gap-0.5 leading-tight">
            <p className="m-0 leading-snug">
              {t(lang, "portal.footer.division")}
            </p>
            <p
              className="m-0 flex items-center gap-1.5 text-[11px] leading-snug opacity-55"
              suppressHydrationWarning
            >
              <span>EGT AI Center Portal</span>
              <span className="opacity-40">·</span>
              {t(lang, "portal.footer.version_label")} {APP_VERSION}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Link
            className="group flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-3 font-normal transition-all duration-150 hover:bg-foreground/[0.05] hover:ring-1 hover:ring-border sm:px-4 dark:hover:bg-white/[0.05] dark:hover:ring-border"
            href="/changelog"
          >
            <FileText className="size-3.5 transition-colors" />
            {t(lang, "portal.footer.button_changelog")}
          </Link>
          {(
            [
              { icon: BookOpen, labelKey: "portal.footer.button_guides" },
              { icon: MessageCircle, labelKey: "portal.footer.button_contact" },
            ] as const
          ).map(({ icon: Icon, labelKey }) => (
            <button
              className="group flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg px-3 font-normal transition-all duration-150 hover:bg-foreground/[0.05] hover:ring-1 hover:ring-border sm:px-4 dark:hover:bg-white/[0.05] dark:hover:ring-border"
              key={labelKey}
              onClick={() =>
                toast.info(t(lang, "portal.footer.toast_coming_soon"))
              }
              type="button"
            >
              <Icon className="size-3.5 transition-colors" />
              {t(lang, labelKey)}
            </button>
          ))}
        </div>
      </div>
    </footer>
  );
}
