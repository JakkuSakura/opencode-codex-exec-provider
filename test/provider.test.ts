import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { selectModel, withResponsesInstructions } from "../src/provider";

test("selectModel uses chat when wire_api is chat", () => {
  const calls: string[] = [];
  const client = {
    chat: (id: string) => {
      calls.push(`chat:${id}`);
      return { kind: "chat", id };
    },
    responses: (id: string) => {
      calls.push(`responses:${id}`);
      return { kind: "responses", id };
    },
  };

  const model = selectModel(client, "chat", "gpt-5.2-codex");
  assert.equal(calls[0], "chat:gpt-5.2-codex");
  assert.equal((model as any).kind, "chat");
});

test("selectModel uses responses when wire_api is responses", () => {
  const calls: string[] = [];
  const client = {
    chat: (id: string) => {
      calls.push(`chat:${id}`);
      return { kind: "chat", id };
    },
    responses: (id: string) => {
      calls.push(`responses:${id}`);
      return { kind: "responses", id };
    },
  };

  const model = selectModel(client, "responses", "gpt-5.2-codex");
  assert.equal(calls[0], "responses:gpt-5.2-codex");
  assert.equal((model as any).kind, "responses");
});

test("withResponsesInstructions injects instructions from system message and strips it", () => {
  const options = {
    prompt: [
      { role: "system", content: "You are Codex." },
      { role: "user", content: "hi" },
    ],
  };

  const next = withResponsesInstructions(options as any, os.tmpdir());
  assert.equal((next.providerOptions as any).openai.instructions, "You are Codex.");
  assert.equal((next.prompt as any[]).length, 1);
  assert.equal((next.prompt as any[])[0].role, "user");
});

test("withResponsesInstructions preserves existing instructions", () => {
  const options = {
    providerOptions: {
      openai: {
        instructions: "Keep this.",
      },
    },
  };

  const next = withResponsesInstructions(options as any, os.tmpdir());
  assert.equal((next.providerOptions as any).openai.instructions, "Keep this.");
});

test("withResponsesInstructions falls back to codex agents when no system message", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "codex-agent-"));
  fs.writeFileSync(path.join(dir, "AGENTS.md"), "Custom agent guidance.");

  const options = {
    prompt: [{ role: "user", content: "hi" }],
  };

  const next = withResponsesInstructions(options as any, dir);
  const instr = (next.providerOptions as any).openai.instructions as string;
  assert.ok(instr.includes("You are Codex, based on GPT-5."));
  assert.ok(instr.includes("Custom agent guidance."));
});
