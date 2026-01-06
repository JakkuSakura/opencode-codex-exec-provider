# opencode-codex-provider

OpenCode provider that reads `~/.codex/config.toml` and uses the configured Codex model provider + API key.

## Setup

1) Install Codex CLI and make sure `codex` is on your PATH.

2) Configure Codex in `~/.codex/config.toml` and login (`codex login`).

3) Clone this repo:

```bash
git clone https://github.com/JakkuSakura/opencode-codex-provider
```

4) Configure OpenCode to use the provider.
Edit `~/.config/opencode/opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "model": "codex-config/default",
  "provider": {
    "codex-config": {
      "npm": "file:///Users/jakku/Dev/opencode-codex-provider",
      "name": "Codex Config",
      "options": {
        "codexHome": "/Users/jakku/.codex",
        "useCodexConfigModel": true
      },
      "models": {
        "default": {
          "id": "default",
          "name": "Codex (from ~/.codex)",
          "family": "codex",
          "reasoning": true,
          "limit": { "context": 272000, "output": 128000 },
          "modalities": { "input": ["text", "image"], "output": ["text"] },
          "options": {
            "reasoningEffort": "medium",
            "reasoningSummary": "auto",
            "textVerbosity": "medium"
          }
        }
      }
    }
  }
}
```

5) Restart OpenCode.

6) In the TUI, run `/models` and select `codex-config/default`.

## Notes

- The provider reads `~/.codex/config.toml` on each request and uses the selected `model_provider` and `model`.
- API keys are resolved from `~/.codex/auth.json` (same as Codex CLI) or from the env var specified by `env_key`.
- `wire_api` controls whether requests go through Chat Completions (`chat`) or Responses (`responses`).

## Options

- `codexHome`: path to Codex home (default: `~/.codex`)
- `useCodexConfigModel`: when true, always use the model from `~/.codex/config.toml`
