import { createLanguageModel } from "./provider";
export function createCodexProvider(options = {}) {
    const providerId = options.name ?? "codex-config";
    const provider = {
        specificationVersion: "v3",
        languageModel(modelId) {
            return createLanguageModel(providerId, modelId, options);
        },
        embeddingModel() {
            throw new Error("codex-config does not support embeddings");
        },
        imageModel() {
            throw new Error("codex-config does not support images");
        },
    };
    const callable = (modelId) => provider.languageModel(modelId);
    return Object.assign(callable, provider);
}
