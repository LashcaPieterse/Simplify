import assert from "node:assert/strict";
import test from "node:test";
import { readBoundedText, BodyError } from "./bounded-body";

test("oversized cloned bodies reject without waiting for the unconsumed original", { timeout: 2000 }, async () => {
  const original = new Request("https://fixture.test", { method: "POST", body: "x".repeat(33 * 1024) });
  try {
    await assert.rejects(readBoundedText(original.clone()), error => error instanceof BodyError && error.status === 413);
  } finally { await original.body?.cancel(); }
});

test("body limits count received bytes and reject malformed UTF-8 before parsing", async () => {
  const body = new Request("https://fixture.test", { method: "POST", headers: { "content-length": "1" }, body: "x".repeat(1025) });
  await assert.rejects(readBoundedText(body, 1024), error => error instanceof BodyError && error.status === 413);
  const invalid = new Request("https://fixture.test", { method: "POST", body: new Uint8Array([0xff]) });
  await assert.rejects(readBoundedText(invalid), error => error instanceof BodyError && error.status === 400);
});
