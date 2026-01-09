# opencode-codex-provider

OpenCode provider that reads `~/.codex/config.toml` and uses the configured Codex model provider + API key.

## Setup

1) Install Codex CLI and make sure `codex` is on your PATH.

2) Configure Codex in `~/.codex/config.toml` and login (`codex login`).

3) Clone this repo:

```bash
git clone https://github.com/JakkuSakura/opencode-codex-provider
```

4) Install dependencies (pnpm) and build if you plan to edit TypeScript:

```bash
pnpm install
pnpm run build
```

5) Configure OpenCode to use the provider.
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

6) Restart OpenCode.

7) In the TUI, run `/models` and select `codex-config/default`.

## Oh-My-OpenCode (default model override)

Oh-My-OpenCode can override agent model choices. To make all agents use Codex, update `~/.config/opencode/oh-my-opencode.json`:

```json
{
  "$schema": "https://raw.githubusercontent.com/code-yeongyu/oh-my-opencode/master/assets/oh-my-opencode.schema.json",
  "agents": {
    "Sisyphus": {
      "model": "codex-config/default"
    },
    "librarian": {
      "model": "codex-config/default"
    },
    "explore": {
      "model": "codex-config/default"
    },
    "oracle": {
      "model": "codex-config/default"
    },
    "frontend-ui-ux-engineer": {
      "model": "codex-config/default"
    },
    "document-writer": {
      "model": "codex-config/default"
    },
    "multimodal-looker": {
      "model": "codex-config/default"
    }
  }
}
```

Reference: https://github.com/code-yeongyu/oh-my-opencode

## LLM installation help

If you want an LLM to help you install or configure this provider, you can paste the full README into OpenCode and ask it to follow the steps. Copy paste the whole page into opencode.

## Image input

OpenCode uses the Vercel AI SDK. For images, send a message part with `type: "image"` and an `image` value (URL, base64, or file id). It is converted to Responses API `input_image` under the hood.

## Plugin paths (conventional)

OpenCode auto-loads local plugins from:

- `~/.config/opencode/plugin/` (global)
- `.opencode/plugin/` (project)

See https://opencode.ai/docs/plugins/ for details.

## Notes

- The provider reads `~/.codex/config.toml` on each request and uses the selected `model_provider` and `model`.
- API keys are resolved from `~/.codex/auth.json` (same as Codex CLI) or from the env var specified by `env_key`.
- `wire_api` controls whether requests go through Chat Completions (`chat`) or Responses (`responses`).
- This provider does not support OpenAI's official consumer Codex endpoints; use a platform API base URL or a compatible proxy.

## Options

- `codexHome`: path to Codex home (default: `~/.codex`)
- `useCodexConfigModel`: when true, always use the model from `~/.codex/config.toml`

### useCodexConfigModel = false

When `useCodexConfigModel` is false, OpenCode controls the model selection. The provider will use the model passed by OpenCode (or the default `codex-config/default`), and ignore `model` in `~/.codex/config.toml`.

**Example (use OpenCode model selection):**

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
        "useCodexConfigModel": false
      },
      "models": {
        "default": {
          "id": "default",
          "name": "Codex (from ~/.codex)",
          "family": "codex",
          "reasoning": true,
          "limit": { "context": 272000, "output": 128000 },
          "modalities": { "input": ["text", "image"], "output": ["text"] }
        },
        "fast": {
          "id": "gpt-4.1-mini",
          "name": "GPT-4.1 Mini",
          "family": "gpt-4.1",
          "reasoning": false,
          "limit": { "context": 128000, "output": 16384 },
          "modalities": { "input": ["text", "image"], "output": ["text"] }
        }
      }
    }
  }
}
```

Then pick a model in OpenCode (e.g., `/models` → `codex-config/fast`).
