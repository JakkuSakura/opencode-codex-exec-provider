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

type InstructionOptions = {
  codexHome: string;
  instructions?: string;
  instructionsFile?: string;
  userInstructionsFile?: string;
  includeUserInstructions?: boolean;
};

function readFileTrimmed(filePath: string): string | undefined {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const trimmed = raw.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  } catch {
    return undefined;
  }
}

function resolveBaseInstructions(opts: InstructionOptions): string {
  const fromFile =
    opts.instructionsFile && path.isAbsolute(opts.instructionsFile)
      ? readFileTrimmed(opts.instructionsFile)
      : opts.instructionsFile
        ? readFileTrimmed(path.join(opts.codexHome, opts.instructionsFile))
        : undefined;
  const fromInline = opts.instructions?.trim();
  return fromFile ?? fromInline ?? DEFAULT_CODEX_INSTRUCTIONS;
}

function resolveUserInstructions(opts: InstructionOptions): string | undefined {
  if (opts.includeUserInstructions === false) return undefined;
  const fromFile =
    opts.userInstructionsFile && path.isAbsolute(opts.userInstructionsFile)
      ? readFileTrimmed(opts.userInstructionsFile)
      : opts.userInstructionsFile
        ? readFileTrimmed(path.join(opts.codexHome, opts.userInstructionsFile))
        : undefined;
  if (fromFile) return fromFile;
  return readFileTrimmed(path.join(opts.codexHome, "AGENTS.md"));
}

function hasUserInstructionsTag(prompt: unknown): boolean {
  if (!Array.isArray(prompt)) return false;
  return prompt.some((msg: any) => {
    if (msg?.role !== "user") return false;
    const content = msg?.content;
    if (typeof content === "string") return content.includes("<user_instructions>");
    if (Array.isArray(content)) {
      return content.some((part: any) => part?.type === "text" && String(part.text).includes("<user_instructions>"));
    }
    return false;
  });
}

function injectUserInstructions(prompt: unknown, userInstructions: string): unknown {
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

export function withResponsesInstructions(
  options: CallOptions,
  instructionOptions: InstructionOptions,
): CallOptions {
  const existing = options.providerOptions?.openai?.instructions;
  if (typeof existing === "string" && existing.length > 0) return options;

  const instructions = resolveBaseInstructions(instructionOptions);
  const userInstructions = resolveUserInstructions(instructionOptions);
  const nextPrompt =
    userInstructions && !hasUserInstructionsTag(options.prompt)
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

function wrapResponsesModel(model: any, instructionOptions: InstructionOptions): any {
  const wrapped = Object.create(model);
  wrapped.doGenerate = (options: CallOptions) =>
    model.doGenerate(withResponsesInstructions(options, instructionOptions));
  wrapped.doStream = (options: CallOptions) =>
    model.doStream(withResponsesInstructions(options, instructionOptions));
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
