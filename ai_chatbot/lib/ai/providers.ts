import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import {
  customProvider,
  extractReasoningMiddleware,
  type LanguageModel,
  wrapLanguageModel,
} from "ai";
import { config } from "../../shared/config";
import { isTestEnvironment } from "../constants";

const THINKING_SUFFIX_REGEX = /-thinking$/;

// Lazy provider creation - only created when first accessed
let _customOpenAIProvider: ReturnType<typeof createOpenAICompatible> | null =
  null;

function getCustomOpenAIProvider() {
  if (!_customOpenAIProvider) {
    _customOpenAIProvider = createOpenAICompatible({
      name: config.ai.providerModel,
      apiKey: config.ai.providerApiKey,
      baseURL: config.ai.providerBaseUrl,
      // Enable usage tracking in streaming responses
      includeUsage: true,
    });
  }
  return _customOpenAIProvider;
}

// Lazy provider wrapper - only created when first accessed
let _myProvider: ReturnType<typeof customProvider> | null = null;

export function getMyProvider() {
  if (!_myProvider) {
    const provider = getCustomOpenAIProvider();
    _myProvider = customProvider({
      languageModels: {
        "chat-model": provider(config.ai.providerModel),
        "chat-model-reasoning": provider(
          config.ai.reasoningModel ?? config.ai.providerModel
        ),
        "title-model": provider(
          config.ai.titleModel ?? config.ai.providerModel
        ),
        "artifact-model": provider(
          config.ai.artifactModel ?? config.ai.providerModel
        ),
      },
    });
  }
  return _myProvider;
}

export function getLanguageModel(modelId: string): LanguageModel {
  if (isTestEnvironment()) {
    const { chatModel, reasoningModel } = require("./models.mock");
    return modelId.includes("reasoning") ? reasoningModel : chatModel;
  }

  const isReasoningModel =
    modelId.includes("reasoning") || modelId.endsWith("-thinking");
  const provider = getCustomOpenAIProvider();

  if (isReasoningModel) {
    const gatewayModelId = modelId.replace(THINKING_SUFFIX_REGEX, "");
    return wrapLanguageModel({
      model: provider(gatewayModelId),
      middleware: extractReasoningMiddleware({ tagName: "thinking" }),
    });
  }

  return provider(modelId);
}

export function getTitleModel(): LanguageModel {
  if (isTestEnvironment()) {
    const { titleModel } = require("./models.mock");
    return titleModel;
  }
  // Fall back to the main chat model when no dedicated title model is configured.
  const provider = getCustomOpenAIProvider();
  return provider(config.ai.titleModel ?? config.ai.providerModel);
}

export function getArtifactModel(): LanguageModel {
  if (isTestEnvironment()) {
    const { artifactModel } = require("./models.mock");
    return artifactModel;
  }
  const provider = getCustomOpenAIProvider();
  return provider(config.ai.artifactModel ?? config.ai.providerModel);
}
