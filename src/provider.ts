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

export function withResponsesInstructions(
  options: CallOptions,
  instructionsOverride?: string,
): CallOptions {
  const existing = options.providerOptions?.openai?.instructions;
  if (typeof existing === "string" && existing.length > 0) return options;

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

function wrapResponsesModel(model: any, instructionsOverride?: string): any {
  const wrapped = Object.create(model);
  wrapped.doGenerate = (options: CallOptions) =>
    model.doGenerate(withResponsesInstructions(options, instructionsOverride));
  wrapped.doStream = (options: CallOptions) =>
    model.doStream(withResponsesInstructions(options, instructionsOverride));
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
    return wrapResponsesModel(model, options.instructions);
  }
  return model;
}
