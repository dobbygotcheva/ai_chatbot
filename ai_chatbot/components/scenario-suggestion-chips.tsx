"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  BookOpen,
  Bug,
  CalendarDays,
  ClipboardCheck,
  Code2,
  FileText,
  GraduationCap,
  Languages,
  Lightbulb,
  Link2,
  ListChecks,
  Mail,
  MessageCircle,
  MessageSquare,
  MonitorPlay,
  PenLine,
  Route,
  Scale,
  ShieldAlert,
  Terminal,
  Users,
  Wand2,
} from "lucide-react";
import type { ComponentType } from "react";
import { t } from "@/lib/i18n";
import {
  getScenarioSuggestionComposeText,
  getScenarioSuggestionExpandedMessage,
  splitScenarioChipLabel,
} from "@/lib/scenario-chip-label";
import {
  SCENARIO_SUGGESTION_BUTTON,
  SCENARIO_SUGGESTION_ICON,
  SCENARIO_SUGGESTION_INNER,
  SCENARIO_SUGGESTION_LABEL,
} from "@/lib/scenario-ui";

const SCENARIO_SUGGESTION_ICONS: Record<
  string,
  ComponentType<{ className?: string }>[]
> = {
  write: [PenLine, Mail, Languages, ListChecks],
  think: [BookOpen, Scale, AlertTriangle, Users],
  create: [Lightbulb, Wand2, MonitorPlay, Link2],
  code: [Code2, Terminal, FileText, Bug],
  improve: [ClipboardCheck, GraduationCap, MessageSquare, MessageCircle],
  plan: [Route, CalendarDays, ShieldAlert, ListChecks],
};

const SCENARIO_SUGGESTION_KEYS: Record<
  string,
  (keyof typeof import("@/lib/i18n").translations.en)[]
> = {
  write: [
    "scenario.write.suggestion1",
    "scenario.write.suggestion2",
    "scenario.write.suggestion3",
    "scenario.write.suggestion4",
  ],
  think: [
    "scenario.think.suggestion1",
    "scenario.think.suggestion2",
    "scenario.think.suggestion3",
    "scenario.think.suggestion4",
  ],
  create: [
    "scenario.create.suggestion1",
    "scenario.create.suggestion2",
    "scenario.create.suggestion3",
    "scenario.create.suggestion4",
  ],
  code: [
    "scenario.code.suggestion1",
    "scenario.code.suggestion2",
    "scenario.code.suggestion3",
    "scenario.code.suggestion4",
  ],
  improve: [
    "scenario.improve.suggestion1",
    "scenario.improve.suggestion2",
    "scenario.improve.suggestion3",
    "scenario.improve.suggestion4",
  ],
  plan: [
    "scenario.plan.suggestion1",
    "scenario.plan.suggestion2",
    "scenario.plan.suggestion3",
    "scenario.plan.suggestion4",
  ],
};

const SCENARIO_LABEL_KEYS = {
  write: "scenario.write",
  think: "scenario.think",
  create: "scenario.create",
  code: "scenario.code",
  improve: "scenario.improve",
  plan: "scenario.plan",
} as const;

type ScenarioSuggestionChipsProps = {
  activeScenario: string | null;
  lang: string;
  onSelectSuggestion: (expandedText: string) => void;
};

export function ScenarioSuggestionChips({
  activeScenario,
  lang,
  onSelectSuggestion,
}: ScenarioSuggestionChipsProps) {
  return (
    <AnimatePresence>
      {activeScenario && SCENARIO_SUGGESTION_KEYS[activeScenario] && (
        <motion.div
          animate={{ opacity: 1, height: "auto" }}
          className="overflow-hidden"
          exit={{ opacity: 0, height: 0 }}
          initial={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
        >
          <div className="grid w-full grid-cols-1 gap-2 pt-1.5 pb-1.5 sm:grid-cols-2 sm:gap-2.5">
            {SCENARIO_SUGGESTION_KEYS[activeScenario].map(
              (suggestionKey, i) => {
                const suggestionFull = t(lang, suggestionKey);
                const { headline } = splitScenarioChipLabel(suggestionFull);
                const composeText =
                  getScenarioSuggestionComposeText(suggestionFull);
                const Icon = SCENARIO_SUGGESTION_ICONS[activeScenario]?.[i];
                const chipAriaLabel =
                  composeText === headline
                    ? headline
                    : `${headline}. ${composeText}`;
                return (
                  <motion.button
                    aria-label={chipAriaLabel}
                    className={SCENARIO_SUGGESTION_BUTTON}
                    key={suggestionKey}
                    onClick={() => {
                      const text = composeText.trim();
                      if (!text) {
                        return;
                      }
                      onSelectSuggestion(
                        getScenarioSuggestionExpandedMessage({
                          requestText: text,
                          lang,
                        })
                      );
                    }}
                    type="button"
                    whileHover={{
                      y: -2,
                      transition: { duration: 0.16, ease: "easeOut" },
                    }}
                    whileTap={{
                      y: 0,
                      scale: 0.985,
                      transition: { duration: 0.08, ease: "easeOut" },
                    }}
                  >
                    <span className={SCENARIO_SUGGESTION_INNER}>
                      {Icon && <Icon className={SCENARIO_SUGGESTION_ICON} />}
                      <span className={SCENARIO_SUGGESTION_LABEL}>
                        {headline}
                      </span>
                    </span>
                    <span className="sr-only">
                      {t(
                        lang,
                        SCENARIO_LABEL_KEYS[
                          activeScenario as keyof typeof SCENARIO_LABEL_KEYS
                        ]
                      )}
                    </span>
                  </motion.button>
                );
              }
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
