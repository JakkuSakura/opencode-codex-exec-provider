import { CodexProviderOptions } from "./config";
type WireApi = "chat" | "responses";
export declare function selectModel(client: {
    chat: (id: string) => unknown;
    responses: (id: string) => unknown;
}, wireApi: WireApi, modelId: string): unknown;
export declare function createLanguageModel(provider: string, modelId: string | undefined, options: CodexProviderOptions, overrideWireApi?: WireApi): any;
export {};
