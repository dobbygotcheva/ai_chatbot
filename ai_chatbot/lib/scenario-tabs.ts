import {
  BrainCircuit,
  CalendarDays,
  ClipboardCheck,
  Code2,
  NotebookPen,
  Palette,
} from "lucide-react";

/** Scenario tab row (portal + `/chat/[id]` composer) — shared icons and ids. */
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

export type ScenarioTabDef = (typeof SCENARIO_TABS)[number];
