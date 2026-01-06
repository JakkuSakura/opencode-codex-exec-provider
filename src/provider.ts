import fs from "node:fs";
import path from "node:path";
import { createOpenAI } from "@ai-sdk/openai";
import { applyQueryParams, loadCodexConfig, resolveModel, CodexProviderOptions } from "./config";

type WireApi = "chat" | "responses";

export function selectModel(
  client: { chat: (id: string) => unknown; responses: (id: string) => unknown },
  wireApi: WireApi,
  modelId: string,
): unknown {
  return wireApi === "chat" ? client.chat(modelId) : client.responses(modelId);
}

const DEFAULT_CODEX_INSTRUCTIONS =
  "You are Codex, based on GPT-5. You are running as a coding agent in the Codex CLI on a user's computer.";

type ProviderOptions = {
  [provider: string]: Record<string, unknown>;
};

type CallOptions = {
  prompt?: unknown;
  providerOptions?: ProviderOptions;
  [key: string]: unknown;
};

function extractInstructions(prompt: any): string | undefined {
  if (!prompt || typeof prompt !== "object") return undefined;
  const messages = Array.isArray(prompt) ? prompt : [];
  const systemTexts = messages
    .filter((msg: any) => msg?.role === "system")
    .map((msg: any) => {
      if (typeof msg.content === "string") return msg.content;
      if (Array.isArray(msg.content)) {
        return msg.content
          .filter((part: any) => part?.type === "text" && typeof part.text === "string")
          .map((part: any) => part.text)
          .join("");
      }
      return "";
    })
    .filter((text: string) => text.trim().length > 0);

  if (systemTexts.length === 0) return undefined;
  return systemTexts.join("\n");
}

function stripSystemMessages(prompt: any): any {
  if (!Array.isArray(prompt)) return prompt;
  return prompt.filter((msg: any) => msg?.role !== "system");
}

function loadCodexAgents(codexHome: string): string | undefined {
  try {
    const agentsPath = path.join(codexHome, "AGENTS.md");
    if (!fs.existsSync(agentsPath)) return undefined;
    const raw = fs.readFileSync(agentsPath, "utf8");
    const trimmed = raw.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  } catch {
    return undefined;
  }
}

export function withResponsesInstructions(options: CallOptions, codexHome: string): CallOptions {
  const existing = options.providerOptions?.openai?.instructions;
  if (typeof existing === "string" && existing.length > 0) return options;

  const systemInstructions = extractInstructions(options.prompt);
  const agentsInstructions = loadCodexAgents(codexHome);
  const instructions =
    systemInstructions ??
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

function wrapResponsesModel(model: any, codexHome: string): any {
  const wrapped = Object.create(model);
  wrapped.doGenerate = (options: CallOptions) =>
    model.doGenerate(withResponsesInstructions(options, codexHome));
  wrapped.doStream = (options: CallOptions) =>
    model.doStream(withResponsesInstructions(options, codexHome));
  return wrapped;
}

export function createLanguageModel(
  provider: string,
  modelId: string | undefined,
  options: CodexProviderOptions,
  overrideWireApi?: WireApi,
): any {
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
