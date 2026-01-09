import { createLanguageModel } from "./provider.js";
export function createCodexProvider(options = {}) {
    const providerId = options.name ?? "codex-config";
    const callable = (modelId) => createLanguageModel(providerId, modelId, options);
    callable.languageModel = (modelId) => createLanguageModel(providerId, modelId, options);
    callable.chat = (modelId) => createLanguageModel(providerId, modelId, options, "chat");
    callable.responses = (modelId) => createLanguageModel(providerId, modelId, options, "responses");
    return Object.assign(callable, {
        embeddingModel() {
            throw new Error("codex-config does not support embeddings");
        },
        imageModel() {
            throw new Error("codex-config does not support images");
        },
    });
}
