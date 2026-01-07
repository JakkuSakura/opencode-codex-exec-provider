import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
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

test("withResponsesInstructions preserves existing instructions", () => {
  const options = {
    providerOptions: {
      openai: {
        instructions: "Keep this.",
      },
    },
  };

  const next = withResponsesInstructions(options as any);
  assert.equal((next.providerOptions as any).openai.instructions, "Keep this.");
});

test("withResponsesInstructions uses override when provided", () => {
  const options = {
    prompt: [{ role: "user", content: "hi" }],
  };

  const next = withResponsesInstructions(options as any, "Override instructions.");
  const instr = (next.providerOptions as any).openai.instructions as string;
  assert.equal(instr, "Override instructions.");
});
