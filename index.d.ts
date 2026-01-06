export type CodexProviderOptions = {
  name?: string;
  codexHome?: string;
  useCodexConfigModel?: boolean;
};

export function createCodexProvider(options?: CodexProviderOptions): any;
