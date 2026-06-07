import {
  AlertTriangle,
  BookOpen,
  BrainCircuit,
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
  NotebookPen,
  Palette,
  PenLine,
  Route,
  Scale,
  ShieldAlert,
  Terminal,
  Users,
  Wand2,
} from "lucide-react";
import type { ComponentType } from "react";

export const SCENARIO_TABS = [
  { id: "write", labelKey: "scenario.write" as const, icon: NotebookPen },
  { id: "think", labelKey: "scenario.think" as const, icon: BrainCircuit },
  { id: "create", labelKey: "scenario.create" as const, icon: Palette },
  { id: "code", labelKey: "scenario.code" as const, icon: Code2 },
  {
    id: "improve",
    labelKey: "scenario.improve" as const,
    icon: ClipboardCheck,
  },
  { id: "plan", labelKey: "scenario.plan" as const, icon: CalendarDays },
] as const;

export type ScenarioTabId = (typeof SCENARIO_TABS)[number]["id"];

export const SCENARIO_SUGGESTION_KEYS: Record<
  ScenarioTabId,
  readonly string[]
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

export const SCENARIO_SUGGESTION_ICONS: Record<
  ScenarioTabId,
  readonly ComponentType<{ className?: string }>[]
> = {
  write: [PenLine, Mail, Languages, ListChecks],
  think: [BookOpen, Scale, AlertTriangle, Users],
  create: [Lightbulb, Wand2, MonitorPlay, Link2],
  code: [Code2, Terminal, FileText, Bug],
  improve: [ClipboardCheck, GraduationCap, MessageSquare, MessageCircle],
  plan: [Route, CalendarDays, ShieldAlert, ListChecks],
};
