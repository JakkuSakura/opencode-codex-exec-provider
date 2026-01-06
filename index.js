import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createOpenAI } from "@ai-sdk/openai";

function stripComment(line) {
  let inSingle = false;
  let inDouble = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === "'" && !inDouble) inSingle = !inSingle;
    if (ch === '"' && !inSingle) inDouble = !inDouble;
    if (ch === "#" && !inSingle && !inDouble) {
      return line.slice(0, i);
    }
  }
  return line;
}

function parseInlineTable(value) {
  const result = {};
  const inner = value.trim().slice(1, -1).trim();
  if (!inner) return result;
  const parts = [];
  let buf = "";
  let inSingle = false;
  let inDouble = false;
  for (let i = 0; i < inner.length; i += 1) {
    const ch = inner[i];
    if (ch === "'" && !inDouble) inSingle = !inSingle;
    if (ch === '"' && !inSingle) inDouble = !inDouble;
    if (ch === "," && !inSingle && !inDouble) {
      parts.push(buf);
      buf = "";
      continue;
    }
    buf += ch;
  }
  if (buf.trim()) parts.push(buf);

  for (const part of parts) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    result[key] = parseValue(val);
  }
  return result;
}

function parseValue(value) {
  const trimmed = value.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return parseInlineTable(trimmed);
  }
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (/^-?\d+$/.test(trimmed)) return Number(trimmed);
  return trimmed;
}

function parseToml(content) {
  const result = { model_providers: {} };
  let currentProvider = null;

  for (const rawLine of content.split(/\r?\n/)) {
    const line = stripComment(rawLine).trim();
    if (!line) continue;
    if (line.startsWith("[") && line.endsWith("]")) {
      const section = line.slice(1, -1).trim();
      if (section.startsWith("model_providers.")) {
        const providerId = section.slice("model_providers.".length);
        currentProvider = providerId;
        if (!result.model_providers[providerId]) result.model_providers[providerId] = {};
      } else {
        currentProvider = null;
      }
      continue;
    }

    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    const value = parseValue(line.slice(eq + 1));
    if (currentProvider) {
      result.model_providers[currentProvider][key] = value;
    } else {
      result[key] = value;
    }
  }

  return result;
}

function readJsonIfExists(filePath) {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function loadCodexConfig(options) {
  const codexHome =
    options?.codexHome ??
    process.env.CODEX_HOME ??
    path.join(os.homedir(), ".codex");

  const configPath = path.join(codexHome, "config.toml");
  const authPath = path.join(codexHome, "auth.json");
  const auth = readJsonIfExists(authPath) ?? {};
  let config = {};
  if (fs.existsSync(configPath)) {
    const raw = fs.readFileSync(configPath, "utf8");
    config = parseToml(raw);
  }

  const providerId = config.model_provider ?? "openai";
  const model = config.model ?? "gpt-5-codex";
  const providerConfig = (config.model_providers ?? {})[providerId] ?? {};

  const wireApi = providerConfig.wire_api ?? (providerId === "openai" ? "responses" : "chat");
  const baseUrl =
    providerConfig.base_url ?? (providerId === "openai" ? "https://api.openai.com/v1" : undefined);
  const requiresOpenaiAuth =
    providerConfig.requires_openai_auth ?? (providerId === "openai");
  const envKey = providerConfig.env_key ?? (requiresOpenaiAuth ? "OPENAI_API_KEY" : null);

  let apiKey = null;
  if (envKey) {
    apiKey = process.env[envKey] || auth[envKey] || null;
  }
  if (!apiKey && requiresOpenaiAuth) {
    apiKey = process.env.OPENAI_API_KEY || auth.OPENAI_API_KEY || auth._OPENAI_API_KEY || null;
  }

  const headers = { ...(providerConfig.http_headers ?? {}) };
  const envHeaders = providerConfig.env_http_headers ?? {};
  for (const [header, envVar] of Object.entries(envHeaders)) {
    const value = process.env[envVar];
    if (value && value.trim()) headers[header] = value;
  }

  return {
    codexHome,
    providerId,
    model,
    wireApi,
    baseUrl,
    apiKey,
    headers,
    queryParams: providerConfig.query_params ?? null,
  };
}

function withQueryParams(baseUrl, queryParams) {
  if (!baseUrl || !queryParams || Object.keys(queryParams).length === 0) return baseUrl;
  const url = new URL(baseUrl);
  for (const [key, value] of Object.entries(queryParams)) {
    if (value === undefined || value === null) continue;
    url.searchParams.set(key, String(value));
  }
  return url.toString();
}

function createLanguageModel({ provider, modelId, options }) {
  const config = loadCodexConfig(options);
  const resolvedModel = options?.useCodexConfigModel !== false ? config.model : modelId;
  if (!resolvedModel) {
    throw new Error("No model configured (set model in ~/.codex/config.toml or OpenCode config)");
  }
  if (!config.baseUrl) {
    throw new Error("No base_url configured for the selected model provider");
  }

  const baseURL = withQueryParams(config.baseUrl, config.queryParams);
  const client = createOpenAI({
    apiKey: config.apiKey ?? undefined,
    baseURL,
    headers: config.headers,
  });

  const model = config.wireApi === "chat" ? client.chat(resolvedModel) : client.responses(resolvedModel);
  return {
    specificationVersion: "v3",
    provider,
    modelId: resolvedModel,
    supportedUrls: {},
    doGenerate: model.doGenerate.bind(model),
    doStream: model.doStream.bind(model),
  };
}

export function createCodexProvider(options = {}) {
  const providerId = options.name ?? "codex-config";
  const provider = {
    specificationVersion: "v3",
    languageModel(modelId) {
      return createLanguageModel({ provider: providerId, modelId, options });
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
