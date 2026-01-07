import { createOpenAI } from "@ai-sdk/openai";
import { applyQueryParams, loadCodexConfig, resolveModel } from "./config";
export function selectModel(client, wireApi, modelId) {
    return wireApi === "chat" ? client.chat(modelId) : client.responses(modelId);
}
const DEFAULT_CODEX_INSTRUCTIONS = "You are Codex, based on GPT-5. You are running as a coding agent in the Codex CLI on a user's computer.";
export function withResponsesInstructions(options, instructionsOverride) {
    const existing = options.providerOptions?.openai?.instructions;
    if (typeof existing === "string" && existing.length > 0)
        return options;
    const instructions = instructionsOverride?.trim() || DEFAULT_CODEX_INSTRUCTIONS;
    return {
        ...options,
        providerOptions: {
            ...(options.providerOptions ?? {}),
            openai: {
                ...(options.providerOptions?.openai ?? {}),
                instructions,
            },
        },
    };
}
function wrapResponsesModel(model, instructionsOverride) {
    const wrapped = Object.create(model);
    wrapped.doGenerate = (options) => model.doGenerate(withResponsesInstructions(options, instructionsOverride));
    wrapped.doStream = (options) => model.doStream(withResponsesInstructions(options, instructionsOverride));
    return wrapped;
}
export function createLanguageModel(provider, modelId, options, overrideWireApi) {
    const config = loadCodexConfig(options);
    const resolvedModel = resolveModel(config.model, modelId, options.useCodexConfigModel);
    if (!resolvedModel) {
        throw new Error("No model configured (set model in ~/.codex/config.toml or OpenCode config)");
    }
    if (!config.baseUrl) {
        throw new Error("No base_url configured for the selected model provider");
    }
    const baseURL = applyQueryParams(config.baseUrl, config.queryParams);
    const client = createOpenAI({
        apiKey: config.apiKey ?? undefined,
        baseURL,
        headers: config.headers,
    });
    const wireApi = overrideWireApi ?? config.wireApi;
    const model = selectModel(client, wireApi, resolvedModel);
    if (wireApi === "responses") {
        return wrapResponsesModel(model, options.instructions);
    }
    return model;
}
