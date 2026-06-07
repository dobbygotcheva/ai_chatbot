import { cn } from "@/lib/utils";

/** Tailwind class sets for sidebar history in the portal slide-out (matches page background in light theme; light text in dark). */
export function getSidebarHistoryPortalPalette(portal: boolean) {
  if (portal) {
    return {
      menuRow:
        "group gap-2.5 font-medium text-[14px] text-foreground/90 transition-colors hover:bg-foreground/[0.06] dark:text-neutral-100/90 dark:hover:bg-white/[0.08]",
      iconMuted: "text-muted-foreground dark:text-neutral-100/70",
      chevron:
        "ml-auto size-4 shrink-0 text-muted-foreground transition-transform duration-200 dark:text-neutral-100/55",
      sectionLabel:
        "mb-0.5 px-2 py-0.5 font-bold text-[11px] text-foreground/60 uppercase tracking-widest dark:text-neutral-100/55",
      sectionToggle:
        "mb-1 flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg px-2 py-2 text-left font-bold text-[12px] text-foreground/65 uppercase tracking-widest transition-colors hover:bg-foreground/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border/60 dark:text-neutral-100/55 dark:hover:bg-white/[0.07] dark:focus-visible:ring-neutral-500/50",
      sectionChevron:
        "size-4 shrink-0 text-foreground/50 transition-transform duration-200 dark:text-neutral-100/50",
      prompt:
        "flex w-full flex-row items-center justify-center gap-2 px-2 text-[14px] text-muted-foreground dark:text-neutral-100/55",
      skeletonLabel:
        "px-2 py-1 font-semibold text-[11px] text-muted-foreground uppercase tracking-wider dark:text-neutral-100/45",
      endLine: "h-px flex-1 bg-foreground/[0.08] dark:bg-white/[0.08]",
      endCaps:
        "shrink-0 font-medium text-[11px] text-muted-foreground uppercase tracking-wider dark:text-neutral-100/40",
      historyNavButton:
        "flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-border/70 bg-muted/40 px-4 py-3 font-medium text-[14px] text-foreground/90 transition-colors hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border/60 dark:border-neutral-600/50 dark:bg-neutral-900/45 dark:text-neutral-100/90 dark:hover:bg-neutral-900/65 dark:focus-visible:ring-neutral-500/50",
      loadingMore:
        "mt-4 flex flex-row items-center justify-center gap-1.5 p-2 text-[13px] text-muted-foreground dark:text-neutral-100/45",
      archivedLoading:
        "flex items-center gap-2 px-2 py-3 text-[13px] text-muted-foreground dark:text-neutral-100/65",
      archivedEmpty:
        "px-2 py-3 text-[13px] text-muted-foreground dark:text-neutral-100/55",
      unarchiveBtn:
        "absolute top-1/2 right-1 -translate-y-1/2 cursor-pointer rounded-md p-1 text-muted-foreground opacity-0 transition-all hover:bg-foreground/10 group-hover/archived:opacity-100 dark:text-neutral-100/55 dark:hover:bg-white/10",
    };
  }

  return {
    menuRow:
      "group gap-2.5 font-medium text-[14px] text-foreground/90 transition-colors hover:bg-black/[0.12] dark:text-white/80 dark:hover:bg-white/[0.08]",
    iconMuted: "text-foreground/65 dark:text-white/55",
    chevron:
      "ml-auto size-4 shrink-0 text-foreground/55 transition-transform duration-200 dark:text-white/45",
    sectionLabel:
      "mb-0.5 px-2 py-0.5 font-bold text-[11px] text-foreground/60 uppercase tracking-widest dark:text-white/50",
    sectionToggle:
      "mb-1 flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg px-2 py-2 text-left font-bold text-[12px] text-foreground/65 uppercase tracking-widest transition-colors hover:bg-black/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20 dark:text-white/55 dark:hover:bg-white/[0.06]",
    sectionChevron:
      "size-4 shrink-0 text-foreground/45 transition-transform duration-200 dark:text-white/45",
    prompt:
      "flex w-full flex-row items-center justify-center gap-2 px-2 text-[13px] text-foreground/50 dark:text-white/45",
    skeletonLabel:
      "px-2 py-1 font-semibold text-[10px] text-sidebar-foreground/45 uppercase tracking-widest",
    endLine: "h-px flex-1 bg-white/[0.08]",
    endCaps:
      "shrink-0 font-medium text-[10px] text-white/25 uppercase tracking-widest",
    historyNavButton:
      "flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 font-medium text-[14px] text-white/70 transition-all duration-150 hover:border-white/20 hover:bg-white/[0.08] hover:text-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/25",
    loadingMore:
      "mt-3 flex flex-row items-center justify-center gap-1.5 p-2 text-[12px] text-foreground/50 dark:text-white/30",
    archivedLoading:
      "flex items-center gap-2 px-2 py-3 text-[13px] text-muted-foreground",
    archivedEmpty: "px-2 py-3 text-[13px] text-muted-foreground/60",
    unarchiveBtn:
      "absolute top-1/2 right-1 -translate-y-1/2 cursor-pointer rounded-md p-1 text-foreground/45 opacity-0 transition-all hover:bg-black/[0.12] group-hover/archived:opacity-100 dark:text-white/50 dark:hover:bg-white/10",
  };
}

export function archivedTitleRowClass(portal: boolean, isActive: boolean) {
  return cn(
    "flex w-full cursor-pointer items-center truncate rounded-lg px-2.5 py-1.5 text-left font-medium text-[14px] transition-colors",
    portal
      ? "text-foreground/90 hover:bg-foreground/[0.06] dark:text-neutral-100/85 dark:hover:bg-white/[0.08]"
      : "text-foreground/80 hover:bg-black/[0.12] dark:hover:bg-white/[0.08]",
    isActive &&
      (portal
        ? "bg-foreground/[0.08] text-foreground dark:bg-white/[0.1] dark:text-neutral-100"
        : "bg-foreground/[0.07] text-foreground")
  );
}

export function getSidebarArchivedSectionPortalPalette(portal: boolean) {
  if (portal) {
    return {
      toggleRow:
        "flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 font-medium text-[14px] text-foreground/90 transition-colors hover:bg-foreground/[0.06] dark:text-neutral-100/90 dark:hover:bg-white/[0.08]",
      iconMuted:
        "size-4 shrink-0 text-muted-foreground dark:text-neutral-100/70",
      chevron:
        "ml-auto size-4 shrink-0 text-muted-foreground transition-transform duration-200 dark:text-neutral-100/55",
      loadingRow:
        "flex items-center gap-2 px-2 py-3 text-[13px] text-muted-foreground dark:text-neutral-100/65",
      unarchiveBtn:
        "absolute top-1/2 right-1 -translate-y-1/2 cursor-pointer rounded-md p-1 text-muted-foreground opacity-0 transition-all hover:bg-foreground/10 group-hover/archived:opacity-100 dark:text-neutral-100/55 dark:hover:bg-white/10",
      empty:
        "px-2 py-2 text-[13px] text-muted-foreground dark:text-neutral-100/50",
    };
  }

  return {
    toggleRow:
      "flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 font-medium text-[14px] text-foreground/90 transition-colors hover:bg-black/[0.12] dark:text-white/80 dark:hover:bg-white/[0.08]",
    iconMuted: "size-4 shrink-0 text-foreground/65 dark:text-white/60",
    chevron:
      "ml-auto size-4 shrink-0 text-foreground/55 transition-transform duration-200 dark:text-white/50",
    loadingRow:
      "flex items-center gap-2 px-2 py-3 text-[13px] text-muted-foreground",
    unarchiveBtn:
      "absolute top-1/2 right-1 -translate-y-1/2 cursor-pointer rounded-md p-1 text-foreground/45 opacity-0 transition-all hover:bg-black/[0.12] group-hover/archived:opacity-100 dark:text-white/50 dark:hover:bg-white/10",
    empty: "px-2 py-2 text-[13px] text-foreground/35",
  };
}
