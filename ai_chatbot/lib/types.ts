import type { InferUITool, UIMessage } from "ai";
import { z } from "zod";
import type { ArtifactKind } from "@/components/artifact";
import type { crawlPages } from "./ai/tools/crawl-pages";
import type { createDocument } from "./ai/tools/create-document";
import type { executeCode } from "./ai/tools/execute-code";
import type { findWebpages } from "./ai/tools/find-webpages";
import type { getCurrentDate } from "./ai/tools/get-current-date";
import type { getWeather } from "./ai/tools/get-weather";
import type { requestSuggestions } from "./ai/tools/request-suggestions";
import type { updateDocument } from "./ai/tools/update-document";
import type { Suggestion } from "./db/schema";

export type DataPart = { type: "append-message"; message: string };

export const messageMetadataSchema = z.object({
  createdAt: z.string(),
});

export type MessageMetadata = z.infer<typeof messageMetadataSchema>;

type weatherTool = InferUITool<typeof getWeather>;
type getCurrentDateTool = InferUITool<typeof getCurrentDate>;
type findWebpagesTool = InferUITool<typeof findWebpages>;
type crawlPagesTool = InferUITool<typeof crawlPages>;
type createDocumentTool = InferUITool<ReturnType<typeof createDocument>>;
type updateDocumentTool = InferUITool<ReturnType<typeof updateDocument>>;
type requestSuggestionsTool = InferUITool<
  ReturnType<typeof requestSuggestions>
>;
type executeCodeTool = InferUITool<ReturnType<typeof executeCode>>;

export type ChatTools = {
  getWeather: weatherTool;
  getCurrentDate: getCurrentDateTool;
  findWebpages: findWebpagesTool;
  crawlPages: crawlPagesTool;
  createDocument: createDocumentTool;
  updateDocument: updateDocumentTool;
  requestSuggestions: requestSuggestionsTool;
  executeCode: executeCodeTool;
};

export type ContextUsageData = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  contextPercentage: number;
};

export type CustomUIDataTypes = {
  textDelta: string;
  imageDelta: string;
  sheetDelta: string;
  codeDelta: string;
  suggestion: Suggestion;
  appendMessage: string;
  id: string;
  title: string;
  kind: ArtifactKind;
  clear: null;
  finish: null;
  "chat-title": string;
  contextUsage: ContextUsageData;
};

export type ChatMessage = UIMessage<
  MessageMetadata,
  CustomUIDataTypes,
  ChatTools
>;

export type Attachment = {
  name: string;
  url: string;
  contentType: string;
};
