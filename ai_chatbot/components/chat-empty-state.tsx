"use client";

import { motion } from "framer-motion";
import { AlertCircle, Globe, Zap } from "lucide-react";
import Link from "next/link";
import { useLanguage } from "@/components/language-selector";
import { t } from "@/lib/i18n";
import { CHROME_GLASS_PANEL } from "@/lib/scenario-ui";
import { cn } from "@/lib/utils";

interface ChatEmptyStateProps {
  onStartChat?: () => void;
}

export function ChatEmptyState({
  onStartChat: _onStartChat,
}: ChatEmptyStateProps) {
  const { lang } = useLanguage();

  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className="flex min-h-[calc(100%-2rem)] flex-col items-center justify-center py-10"
      exit={{ opacity: 0, y: -10, transition: { duration: 0.2 } }}
      initial={{ opacity: 0, y: 12 }}
      transition={{ duration: 0.4 }}
    >
      <div className="mx-auto flex w-full max-w-4xl flex-col space-y-4">
        <div className="flex w-full flex-row items-stretch gap-4 px-4 md:gap-6 md:px-5">
          <div className="relative -ml-4 flex shrink-0 items-center self-stretch">
            <div className="size-20 overflow-hidden rounded-full bg-black md:size-24">
              {/* biome-ignore lint: using static image asset */}
              <img
                alt="Destiny"
                className="size-full object-cover object-center"
                src="/images/destiny-avatar.png"
              />
            </div>
            <span
              aria-hidden
              className="absolute right-1 bottom-1 size-3.5 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(52,211,153,0.65)] ring-2 ring-background dark:bg-emerald-400"
            />
          </div>
          <div className="grid w-full min-w-0 flex-1 content-center gap-1.5 text-start">
            <h1 className="m-0 w-full min-w-0 p-0 font-semibold text-3xl text-foreground leading-none md:text-4xl dark:text-white">
              {t(lang, "portal.destiny.name")}
            </h1>
            <p className="m-0 w-full min-w-0 max-w-[20rem] font-medium text-[13px] text-foreground/78 uppercase leading-snug dark:text-white/78">
              <span className="inline-block w-full pl-0.5 text-start tracking-[0.14em]">
                {t(lang, "portal.destiny.description_short")}
              </span>
            </p>
          </div>
        </div>

        <div
          className={cn(
            "w-full rounded-xl px-4 py-4 md:px-5",
            CHROME_GLASS_PANEL
          )}
        >
          <div className="flex flex-col gap-3.5 md:gap-4">
            <div className="flex items-center gap-3 text-foreground/90 text-sm leading-relaxed dark:text-white/88">
              <div
                aria-hidden
                className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted/52 ring-1 ring-border/45 dark:bg-white/[0.08] dark:ring-white/[0.11]"
              >
                <AlertCircle
                  className="size-4 text-foreground/82 dark:text-white/82"
                  strokeWidth={2}
                />
              </div>
              <p className="m-0 min-w-0 flex-1">
                {t(lang, "chat.compliance1")}
              </p>
            </div>
            <div className="flex items-center gap-3 text-foreground/90 text-sm leading-relaxed dark:text-white/88">
              <div
                aria-hidden
                className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted/52 ring-1 ring-border/45 dark:bg-white/[0.08] dark:ring-white/[0.11]"
              >
                <Globe
                  className="size-4 text-foreground/82 dark:text-white/82"
                  strokeWidth={2}
                />
              </div>
              <p className="m-0 min-w-0 flex-1">
                {t(lang, "chat.compliance2")}
              </p>
            </div>
            <div className="flex items-center gap-3 text-foreground/90 text-sm leading-relaxed dark:text-white/88">
              <div
                aria-hidden
                className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted/52 ring-1 ring-border/45 dark:bg-white/[0.08] dark:ring-white/[0.11]"
              >
                <Zap
                  className="size-4 text-foreground/82 dark:text-white/82"
                  strokeWidth={2}
                />
              </div>
              <p className="m-0 min-w-0 flex-1">
                {t(lang, "chat.compliance3")}{" "}
                <Link
                  aria-label={t(lang, "chat.compliance3_link_aria_confluence")}
                  className="font-medium text-foreground/92 underline underline-offset-2 transition-colors hover:text-foreground dark:text-white/90"
                  href="/settings?section=Apps"
                >
                  {t(lang, "chat.terms")}
                </Link>
                {", "}
                <Link
                  aria-label={t(lang, "chat.compliance3_link_aria_jira")}
                  className="font-medium text-foreground/92 underline underline-offset-2 transition-colors hover:text-foreground dark:text-white/90"
                  href="/settings?section=Apps"
                >
                  {t(lang, "chat.and")}
                </Link>
                {t(lang, "chat.compliance3_before_last_link")}
                <Link
                  aria-label={t(
                    lang,
                    "chat.compliance3_link_aria_service_desk"
                  )}
                  className="font-medium text-foreground/92 underline underline-offset-2 transition-colors hover:text-foreground dark:text-white/90"
                  href="/settings?section=Apps"
                >
                  {t(lang, "chat.privacy")}
                </Link>
                {t(lang, "chat.compliance3_sentence_end")}
              </p>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
