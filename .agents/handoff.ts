/**
 * Agent Handoff System
 *
 * Manages communication and task delegation between specialized agents.
 * Implements cycle detection, queue management, and handoff logging.
 */

import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

/**
 * Get the git repository root directory
 */
function getGitRoot(): string {
  try {
    return execSync("git rev-parse --show-toplevel").toString().trim();
  } catch {
    // Fallback to directory resolution if not in git repo
    return resolve(new URL(".", import.meta.url).pathname, "..");
  }
}

const GIT_ROOT = getGitRoot();
const HANDOFF_DIR = join(GIT_ROOT, ".agents", "handoffs");
const MAX_HANDOFF_DEPTH = 3;
const CYCLE_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Valid project prefixes in the monorepo
 */
const VALID_PROJECT_PREFIXES = ["ai_chatbot/", "crawl4ai/", "mcp-atlassian/"];

/**
 * Validate that a path is within the monorepo
 */
export function isValidProjectPath(path: string): boolean {
  return VALID_PROJECT_PREFIXES.some((prefix) => path.startsWith(prefix));
}

/**
 * Resolve a relative path from git root
 */
export function resolveProjectPath(relativePath: string): string {
  return join(GIT_ROOT, relativePath);
}

export type AgentName =
  | "General"
  | "Frontend"
  | "Backend"
  | "Testing"
  | "Code Quality"
  | "DevOps";

export interface Handoff {
  id: string;
  from: AgentName;
  to: AgentName;
  condition: string;
  message: string;
  timestamp: number;
  depth: number;
  context?: Record<string, unknown>;
  status: "pending" | "processing" | "completed" | "failed";
}

export interface HandoffLog {
  handoffs: Handoff[];
  cycleHistory: Array<{ agent: AgentName; timestamp: number }>[];
}

function ensureHandoffDir(): void {
  if (!existsSync(HANDOFF_DIR)) {
    mkdirSync(HANDOFF_DIR, { recursive: true });
  }
}

function getLogPath(): string {
  return join(HANDOFF_DIR, "handoff-log.json");
}

function loadLog(): HandoffLog {
  const logPath = getLogPath();
  if (!existsSync(logPath)) {
    return { handoffs: [], cycleHistory: [] };
  }
  const content = readFileSync(logPath, "utf-8");
  return JSON.parse(content) as HandoffLog;
}

function saveLog(log: HandoffLog): void {
  ensureHandoffDir();
  writeFileSync(getLogPath(), JSON.stringify(log, null, 2));
}

function generateId(): string {
  return `h_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function detectCycle(log: HandoffLog, agentChain: AgentName[]): boolean {
  const recentHistory = log.cycleHistory.filter((h) => {
    const last = h.at(-1);
    return last !== undefined && Date.now() - last.timestamp < CYCLE_WINDOW_MS;
  });

  for (const history of recentHistory) {
    const agents = history.map((h) => h.agent);
    const combined = [...agents, ...agentChain];

    const agentCounts = new Map<AgentName, number>();
    for (const agent of combined) {
      agentCounts.set(agent, (agentCounts.get(agent) || 0) + 1);
      if ((agentCounts.get(agent) as number) > 2) {
        return true;
      }
    }
  }

  return false;
}

export function createHandoff(
  from: AgentName,
  to: AgentName,
  condition: string,
  message: string,
  context?: Record<string, unknown>,
  depth = 1
): Handoff | null {
  const log = loadLog();
  const agentChain: AgentName[] = [from, to];

  if (depth > MAX_HANDOFF_DEPTH) {
    console.error(
      `[Handoff] Max depth (${MAX_HANDOFF_DEPTH}) exceeded. Aborting.`
    );
    return null;
  }

  if (detectCycle(log, agentChain)) {
    console.error(
      `[Handoff] Cycle detected between ${from} and ${to}. Aborting.`
    );
    return null;
  }

  const handoff: Handoff = {
    id: generateId(),
    from,
    to,
    condition,
    message,
    timestamp: Date.now(),
    depth,
    context,
    status: "pending",
  };

  log.handoffs.push(handoff);
  log.cycleHistory.push([{ agent: from, timestamp: Date.now() }]);
  saveLog(log);

  console.log(`[Handoff] ${from} → ${to}: ${condition}`);
  return handoff;
}

export function updateHandoffStatus(
  id: string,
  status: Handoff["status"]
): void {
  const log = loadLog();
  const handoff = log.handoffs.find((h) => h.id === id);
  if (handoff) {
    handoff.status = status;
    saveLog(log);
  }
}

export function getPendingHandoffs(agent: AgentName): Handoff[] {
  const log = loadLog();
  return log.handoffs.filter((h) => h.to === agent && h.status === "pending");
}

export function getAgentChain(handoffId: string): AgentName[] {
  const log = loadLog();
  const handoff = log.handoffs.find((h) => h.id === handoffId);
  if (!handoff) {
    return [];
  }

  const chain: AgentName[] = [handoff.from];
  let current = handoff.to;

  for (const h of log.handoffs) {
    if (h.from === current) {
      chain.push(h.from);
      current = h.to;
    }
  }

  return chain;
}

export function clearOldHandoffs(maxAgeHours = 24): void {
  const log = loadLog();
  const cutoff = Date.now() - maxAgeHours * 60 * 60 * 1000;

  log.handoffs = log.handoffs.filter((h) => h.timestamp > cutoff);
  log.cycleHistory = log.cycleHistory.filter((h) => {
    const last = h.at(-1);
    return last !== undefined && last.timestamp > cutoff;
  });

  saveLog(log);
}

export function getHandoffStats(): {
  total: number;
  byAgent: Record<AgentName, number>;
  byStatus: Record<Handoff["status"], number>;
} {
  const log = loadLog();

  const stats = {
    total: log.handoffs.length,
    byAgent: {} as Record<AgentName, number>,
    byStatus: {
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
    } as Record<Handoff["status"], number>,
  };

  for (const handoff of log.handoffs) {
    stats.byAgent[handoff.to] = (stats.byAgent[handoff.to] || 0) + 1;
    stats.byStatus[handoff.status]++;
  }

  return stats;
}

// Run if executed directly
const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain || process.argv[1]?.endsWith("handoff.ts")) {
  console.log("Agent Handoff System initialized");
  console.log("Git root:", GIT_ROOT);
  console.log("Handoff directory:", HANDOFF_DIR);
  console.log("Max depth:", MAX_HANDOFF_DEPTH);
  console.log("Cycle window:", CYCLE_WINDOW_MS / 1000, "seconds");
  console.log("Valid projects:", VALID_PROJECT_PREFIXES.join(", "));
}
