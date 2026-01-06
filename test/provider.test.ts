import test from "node:test";
import assert from "node:assert/strict";
import { selectModel } from "../src/provider";

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
