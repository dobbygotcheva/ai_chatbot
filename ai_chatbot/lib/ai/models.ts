// Curated list of top models from Vercel AI Gateway
export const DEFAULT_CHAT_MODEL = "foundation";

export type ChatModel = {
  id: string;
  name: string;
  provider: string;
  description: string;
};

export const chatModels: ChatModel[] = [
  // OpenAI compatible
  {
    id: "foundation",
    name: "egt.digital",
    provider: "EGT_Digital",
    description: "Fast and cost-effective for simple tasks",
  },
];

// Group models by provider for UI
export const modelsByProvider = chatModels.reduce(
  (acc, model) => {
    if (!acc[model.provider]) {
      acc[model.provider] = [];
    }
    acc[model.provider].push(model);
    return acc;
  },
  {} as Record<string, ChatModel[]>
);
