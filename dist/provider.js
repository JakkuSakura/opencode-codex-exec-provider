import fs from "node:fs";
import path from "node:path";
import { createOpenAI } from "@ai-sdk/openai";
import { applyQueryParams, loadCodexConfig, resolveModel } from "./config";
export function selectModel(client, wireApi, modelId) {
    return wireApi === "chat" ? client.chat(modelId) : client.responses(modelId);
}
const DEFAULT_CODEX_INSTRUCTIONS = "You are Codex, based on GPT-5. You are running as a coding agent in the Codex CLI on a user's computer.";
function readFileTrimmed(filePath) {
    try {
        const raw = fs.readFileSync(filePath, "utf8");
        const trimmed = raw.trim();
        return trimmed.length > 0 ? trimmed : undefined;
    }
    catch {
        return undefined;
    }
}
function resolveBaseInstructions(opts) {
    const fromFile = opts.instructionsFile && path.isAbsolute(opts.instructionsFile)
        ? readFileTrimmed(opts.instructionsFile)
        : opts.instructionsFile
            ? readFileTrimmed(path.join(opts.codexHome, opts.instructionsFile))
            : undefined;
    const fromInline = opts.instructions?.trim();
    return fromFile ?? fromInline ?? DEFAULT_CODEX_INSTRUCTIONS;
}
function resolveUserInstructions(opts) {
    if (opts.includeUserInstructions === false)
        return undefined;
    const fromFile = opts.userInstructionsFile && path.isAbsolute(opts.userInstructionsFile)
        ? readFileTrimmed(opts.userInstructionsFile)
        : opts.userInstructionsFile
            ? readFileTrimmed(path.join(opts.codexHome, opts.userInstructionsFile))
            : undefined;
    if (fromFile)
        return fromFile;
    return readFileTrimmed(path.join(opts.codexHome, "AGENTS.md"));
}
function hasUserInstructionsTag(prompt) {
    if (!Array.isArray(prompt))
        return false;
    return prompt.some((msg) => {
        if (msg?.role !== "user")
            return false;
        const content = msg?.content;
        if (typeof content === "string")
            return content.includes("<user_instructions>");
        if (Array.isArray(content)) {
            return content.some((part) => part?.type === "text" && String(part.text).includes("<user_instructions>"));
        }
        return false;
    });
}
function injectUserInstructions(prompt, userInstructions) {
    const wrapped = `<user_instructions>\n${userInstructions}\n</user_instructions>`;
    const message = {
        role: "user",
        content: [{ type: "text", text: wrapped }],
    };
    if (Array.isArray(prompt)) {
        return [message, ...prompt];
    }
    return [message];
}
export function withResponsesInstructions(options, instructionOptions) {
    const existing = options.providerOptions?.openai?.instructions;
    if (typeof existing === "string" && existing.length > 0)
        return options;
    const instructions = resolveBaseInstructions(instructionOptions);
    const userInstructions = resolveUserInstructions(instructionOptions);
    const nextPrompt = userInstructions && !hasUserInstructionsTag(options.prompt)
        ? injectUserInstructions(options.prompt, userInstructions)
        : options.prompt;
    return {
        ...options,
        prompt: nextPrompt,
        providerOptions: {
            ...(options.providerOptions ?? {}),
            openai: {
                ...(options.providerOptions?.openai ?? {}),
                instructions,
            },
        },
    };
}
function wrapResponsesModel(model, instructionOptions) {
    const wrapped = Object.create(model);
    wrapped.doGenerate = (options) => model.doGenerate(withResponsesInstructions(options, instructionOptions));
    wrapped.doStream = (options) => model.doStream(withResponsesInstructions(options, instructionOptions));
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
        return wrapResponsesModel(model, {
            codexHome: config.codexHome,
            instructions: options.instructions,
            instructionsFile: options.instructionsFile,
            userInstructionsFile: options.userInstructionsFile,
            includeUserInstructions: options.includeUserInstructions,
        });
    }
    return model;
}
