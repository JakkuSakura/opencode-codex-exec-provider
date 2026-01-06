import fs from "node:fs";
import path from "node:path";
import { createOpenAI } from "@ai-sdk/openai";
import { applyQueryParams, loadCodexConfig, resolveModel } from "./config";
export function selectModel(client, wireApi, modelId) {
    return wireApi === "chat" ? client.chat(modelId) : client.responses(modelId);
}
const DEFAULT_CODEX_INSTRUCTIONS = "You are Codex, based on GPT-5. You are running as a coding agent in the Codex CLI on a user's computer.";
function extractInstructions(prompt) {
    if (!prompt || typeof prompt !== "object")
        return undefined;
    const messages = Array.isArray(prompt) ? prompt : [];
    const systemTexts = messages
        .filter((msg) => msg?.role === "system")
        .map((msg) => {
        if (typeof msg.content === "string")
            return msg.content;
        if (Array.isArray(msg.content)) {
            return msg.content
                .filter((part) => part?.type === "text" && typeof part.text === "string")
                .map((part) => part.text)
                .join("");
        }
        return "";
    })
        .filter((text) => text.trim().length > 0);
    if (systemTexts.length === 0)
        return undefined;
    return systemTexts.join("\n");
}
function stripSystemMessages(prompt) {
    if (!Array.isArray(prompt))
        return prompt;
    return prompt.filter((msg) => msg?.role !== "system");
}
function loadCodexAgents(codexHome) {
    try {
        const agentsPath = path.join(codexHome, "AGENTS.md");
        if (!fs.existsSync(agentsPath))
            return undefined;
        const raw = fs.readFileSync(agentsPath, "utf8");
        const trimmed = raw.trim();
        return trimmed.length > 0 ? trimmed : undefined;
    }
    catch {
        return undefined;
    }
}
export function withResponsesInstructions(options, codexHome) {
    const existing = options.providerOptions?.openai?.instructions;
    if (typeof existing === "string" && existing.length > 0)
        return options;
    const systemInstructions = extractInstructions(options.prompt);
    const agentsInstructions = loadCodexAgents(codexHome);
    const instructions = systemInstructions ??
        (agentsInstructions
            ? `${DEFAULT_CODEX_INSTRUCTIONS}\n\n${agentsInstructions}`
            : DEFAULT_CODEX_INSTRUCTIONS);
    return {
        ...options,
        prompt: stripSystemMessages(options.prompt),
        providerOptions: {
            ...(options.providerOptions ?? {}),
            openai: {
                ...(options.providerOptions?.openai ?? {}),
                instructions,
            },
        },
    };
}
function wrapResponsesModel(model, codexHome) {
    const wrapped = Object.create(model);
    wrapped.doGenerate = (options) => model.doGenerate(withResponsesInstructions(options, codexHome));
    wrapped.doStream = (options) => model.doStream(withResponsesInstructions(options, codexHome));
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
        return wrapResponsesModel(model, config.codexHome);
    }
    return model;
}
