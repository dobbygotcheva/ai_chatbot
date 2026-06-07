"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { t } from "@/lib/i18n";
import { CHROME_GLASS_PANEL } from "@/lib/scenario-ui";
import { cn } from "@/lib/utils";
import { useLanguage } from "./language-selector";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

export const Greeting = () => {
  const { lang } = useLanguage();

  return (
    <div
      className="mx-auto mt-4 flex size-full max-w-4xl flex-col items-center justify-center px-4 md:mt-12 md:px-8"
      key="overview"
    >
      <motion.div
        animate={{ opacity: 1, scale: 1 }}
        className="relative mb-6"
        initial={{ opacity: 0, scale: 0.85 }}
        transition={{
          delay: 0.15,
          type: "spring",
          stiffness: 180,
          damping: 14,
        }}
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="destiny-avatar-ring relative size-[88px] cursor-default overflow-hidden rounded-full md:size-[104px]">
              <Image
                alt="Destiny"
                className="size-full object-cover object-center"
                height={104}
                src="/images/destiny-avatar.png"
                width={104}
              />
            </div>
          </TooltipTrigger>
          <TooltipContent>Destiny — Online</TooltipContent>
        </Tooltip>
        <span className="destiny-online-dot absolute right-1 bottom-1 block size-4 rounded-full border-[2.5px] border-background bg-emerald-400 md:size-[18px]" />
      </motion.div>

      <motion.h1
        animate={{ opacity: 1, y: 0 }}
        className="mb-2 max-w-lg text-center font-semibold text-2xl leading-snug tracking-tight"
        initial={{ opacity: 0, y: 14 }}
        transition={{ delay: 0.35, duration: 0.5 }}
      >
        {t(lang, "chat.greeting")}
      </motion.h1>

      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="mt-4 w-full max-w-xl"
        initial={{ opacity: 0, y: 10 }}
        transition={{ delay: 0.55, duration: 0.45 }}
      >
        <div className="flex flex-col gap-2.5">
          {/* Disclaimer 1 — can make mistakes */}
          <div
            className={cn(
              "flex items-start gap-3 rounded-xl px-3.5 py-2.5",
              CHROME_GLASS_PANEL
            )}
          >
            <div className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-muted/60 ring-1 ring-border/45 dark:bg-white/[0.08] dark:ring-white/[0.12]">
              <svg
                className="size-3 text-primary"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                viewBox="0 0 24 24"
              >
                <title>Warning</title>
                <circle cx="12" cy="12" r="10" />
                <line x1="12" x2="12" y1="8" y2="12" />
                <circle cx="12" cy="16" fill="currentColor" r="0.5" />
              </svg>
            </div>
            <p className="text-[12px] text-muted-foreground/70 leading-snug">
              {t(lang, "chat.compliance1")}
            </p>
          </div>

          {/* Disclaimer 2 — language support */}
          <div
            className={cn(
              "flex items-start gap-3 rounded-xl px-3.5 py-2.5",
              CHROME_GLASS_PANEL
            )}
          >
            <div className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-muted/60 ring-1 ring-border/45 dark:bg-white/[0.08] dark:ring-white/[0.12]">
              <svg
                className="size-3 text-primary"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                viewBox="0 0 24 24"
              >
                <title>Languages</title>
                <circle cx="12" cy="12" r="10" />
                <line x1="2" x2="22" y1="12" y2="12" />
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
              </svg>
            </div>
            <p className="text-[12px] text-muted-foreground/70 leading-snug">
              {t(lang, "chat.compliance2")}
            </p>
          </div>

          {/* Disclaimer 3 — capabilities with token links */}
          <div
            className={cn(
              "flex items-start gap-3 rounded-xl px-3.5 py-2.5",
              CHROME_GLASS_PANEL
            )}
          >
            <div className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-muted/60 ring-1 ring-border/45 dark:bg-white/[0.08] dark:ring-white/[0.12]">
              <svg
                className="size-3 text-primary"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                viewBox="0 0 24 24"
              >
                <title>Capabilities</title>
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
            </div>
            <p className="text-[12px] text-muted-foreground/70 leading-snug">
              {t(lang, "chat.compliance3")}{" "}
              <Link
                aria-label={t(lang, "chat.compliance3_link_aria_confluence")}
                className="font-medium text-primary/80 underline underline-offset-2 transition-colors hover:text-primary"
                href="/settings?section=Apps"
              >
                {t(lang, "chat.terms")}
              </Link>
              {", "}
              <Link
                aria-label={t(lang, "chat.compliance3_link_aria_jira")}
                className="font-medium text-primary/80 underline underline-offset-2 transition-colors hover:text-primary"
                href="/settings?section=Apps"
              >
                {t(lang, "chat.and")}
              </Link>
              {t(lang, "chat.compliance3_before_last_link")}
              <Link
                aria-label={t(lang, "chat.compliance3_link_aria_service_desk")}
                className="font-medium text-primary/80 underline underline-offset-2 transition-colors hover:text-primary"
                href="/settings?section=Apps"
              >
                {t(lang, "chat.privacy")}
              </Link>
              {t(lang, "chat.compliance3_sentence_end")}
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
