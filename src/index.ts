import { createLanguageModel } from "./provider";
import type { CodexProviderOptions } from "./config";

export type { CodexProviderOptions };

export function createCodexProvider(options: CodexProviderOptions = {}): any {
  const providerId = options.name ?? "codex-config";

  const provider = {
    specificationVersion: "v3",
    languageModel(modelId?: string) {
      return createLanguageModel(providerId, modelId, options);
    },
    embeddingModel() {
      throw new Error("codex-config does not support embeddings");
    },
    imageModel() {
      throw new Error("codex-config does not support images");
    },
  };

  const callable = (modelId?: string) => provider.languageModel(modelId);
  return Object.assign(callable, provider);
}
