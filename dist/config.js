import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { parseToml } from "./toml.js";
function isProviderConfig(value) {
    return (value ?? {});
}
function readJsonIfExists(filePath) {
    try {
        const raw = fs.readFileSync(filePath, "utf8");
        return JSON.parse(raw);
    }
    catch {
        return null;
    }
}
function resolveDefaultWireApi(providerId) {
    return providerId === "openai" ? "responses" : "chat";
}
function resolveBaseUrl(providerId, providerConfig) {
    if (providerConfig.base_url)
        return providerConfig.base_url;
    if (providerId === "openai")
        return "https://api.openai.com/v1";
    return undefined;
}
function resolveRequiresOpenaiAuth(providerId, providerConfig) {
    if (typeof providerConfig.requires_openai_auth === "boolean")
        return providerConfig.requires_openai_auth;
    return providerId === "openai";
}
function resolveApiKey(requiresOpenaiAuth, envKey, auth) {
    if (envKey) {
        return process.env[envKey] || auth[envKey] || null;
    }
    if (requiresOpenaiAuth) {
        return process.env.OPENAI_API_KEY || auth.OPENAI_API_KEY || auth._OPENAI_API_KEY || null;
    }
    return null;
}
export function loadCodexConfig(options = {}) {
    const codexHome = options.codexHome ?? process.env.CODEX_HOME ?? path.join(os.homedir(), ".codex");
    const configPath = path.join(codexHome, "config.toml");
    const authPath = path.join(codexHome, "auth.json");
    const auth = readJsonIfExists(authPath) ?? {};
    const config = fs.existsSync(configPath)
        ? parseToml(fs.readFileSync(configPath, "utf8"))
        : { model_providers: {} };
    const providerId = config.model_provider ?? "openai";
    const model = config.model ?? "gpt-5-codex";
    const providerTable = config.model_providers ?? {};
    const providerConfig = isProviderConfig(providerTable[providerId]);
    const wireApi = providerConfig.wire_api ?? resolveDefaultWireApi(providerId);
    if (wireApi !== "chat" && wireApi !== "responses") {
        throw new Error(`Unsupported wire_api: ${String(wireApi)}`);
    }
    const baseUrl = resolveBaseUrl(providerId, providerConfig);
    const requiresOpenaiAuth = resolveRequiresOpenaiAuth(providerId, providerConfig);
    const envKey = providerConfig.env_key ?? (requiresOpenaiAuth ? "OPENAI_API_KEY" : null);
    const apiKey = resolveApiKey(requiresOpenaiAuth, envKey, auth);
    const headers = { ...(providerConfig.http_headers ?? {}) };
    const envHeaders = providerConfig.env_http_headers ?? {};
    for (const [header, envVar] of Object.entries(envHeaders)) {
        const value = process.env[envVar];
        if (value && value.trim())
            headers[header] = value;
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
export function resolveModel(configModel, modelId, useCodexConfigModel) {
    if (useCodexConfigModel !== false)
        return configModel;
    if (modelId && modelId !== "default")
        return modelId;
    return configModel;
}
export function applyQueryParams(baseUrl, queryParams) {
    if (!queryParams || Object.keys(queryParams).length === 0)
        return baseUrl;
    const url = new URL(baseUrl);
    for (const [key, value] of Object.entries(queryParams)) {
        if (value === undefined || value === null)
            continue;
        url.searchParams.set(key, String(value));
    }
    return url.toString();
}
