/**
 * Body fields for `sendMessage` when a scenario tab is active (tab kickoff instruction).
 * No hidden instructions - everything is transparent in the user message.
 */
export function getScenarioTabKickoffOptionsForActiveTab(
  _activeScenario?: string | null
): { body: Record<string, never> } {
  return { body: {} };
}
