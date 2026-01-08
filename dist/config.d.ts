export type ProviderConfig = {
    name?: string;
    base_url?: string;
    env_key?: string;
    wire_api?: "chat" | "responses";
    query_params?: Record<string, string | number | boolean>;
    http_headers?: Record<string, string>;
    env_http_headers?: Record<string, string>;
    requires_openai_auth?: boolean;
};
export type CodexConfig = {
    codexHome: string;
    providerId: string;
    model: string;
    wireApi: "chat" | "responses";
    baseUrl?: string;
    apiKey?: string | null;
    headers: Record<string, string>;
    queryParams?: Record<string, string | number | boolean> | null;
};
export type CodexProviderOptions = {
    name?: string;
    codexHome?: string;
    useCodexConfigModel?: boolean;
    instructions?: string;
    instructionsFile?: string;
    userInstructionsFile?: string;
    includeUserInstructions?: boolean;
};
export declare function loadCodexConfig(options?: CodexProviderOptions): CodexConfig;
export declare function resolveModel(configModel: string, modelId: string | undefined, useCodexConfigModel: boolean | undefined): string;
export declare function applyQueryParams(baseUrl: string, queryParams?: Record<string, string | number | boolean> | null): string;
