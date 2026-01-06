import { createLanguageModel } from "./provider";
import type { CodexProviderOptions } from "./config";

export type { CodexProviderOptions };

export function createCodexProvider(options: CodexProviderOptions = {}): any {
  const providerId = options.name ?? "codex-config";

  const callable = (modelId?: string) => createLanguageModel(providerId, modelId, options);
  callable.languageModel = (modelId?: string) => createLanguageModel(providerId, modelId, options);
  callable.chat = (modelId?: string) => createLanguageModel(providerId, modelId, options, "chat");
  callable.responses = (modelId?: string) => createLanguageModel(providerId, modelId, options, "responses");

  return Object.assign(callable, {
    embeddingModel() {
      throw new Error("codex-config does not support embeddings");
    },
    imageModel() {
      throw new Error("codex-config does not support images");
    },
  });
}
