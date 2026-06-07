import { t } from "@/lib/i18n";

/**
 * Source strings use "label (displayText)".
 * Chips show only the label; clicking sends displayText as the user message
 * (text inside the parentheses). The model also receives the matching
 * hidden prompt via `scenarioInstructionKey` on the request.
 */

export function splitScenarioChipLabel(full: string): {
  headline: string;
  parenthetical: string | null;
} {
  const trimmed = full.trim();
  const open = trimmed.indexOf("(");
  if (open === -1) {
    return { headline: trimmed, parenthetical: null };
  }
  const close = trimmed.lastIndexOf(")");
  if (close <= open) {
    return { headline: trimmed, parenthetical: null };
  }
  const headline = trimmed.slice(0, open).trim();
  const parenthetical = trimmed.slice(open + 1, close).trim();
  if (headline.length === 0) {
    return { headline: trimmed, parenthetical: null };
  }
  return { headline, parenthetical };
}

/** Text placed in the composer when a suggestion chip is chosen (expansion, or full line if no parens). */
export function getScenarioSuggestionComposeText(full: string): string {
  const { headline, parenthetical } = splitScenarioChipLabel(full);
  if (parenthetical !== null && parenthetical.length > 0) {
    return parenthetical;
  }
  return headline;
}

/** Short helper text shown inside each suggestion bubble. */
export function getScenarioSuggestionPreviewText(full: string): string {
  const { parenthetical, headline } = splitScenarioChipLabel(full);
  const source =
    parenthetical && parenthetical.length > 0 ? parenthetical : headline;
  if (source.length <= 92) {
    return source;
  }
  return `${source.slice(0, 89).trimEnd()}...`;
}

/** Expanded message sent to chat when a scenario suggestion is clicked. */
export function getScenarioSuggestionExpandedMessage({
  requestText,
  lang,
}: {
  requestText: string;
  lang: string;
}): string {
  const actionableInstruction = t(lang, "chat.suggestion.actionable_response");

  return `${requestText}\n\n${actionableInstruction}`;
}
