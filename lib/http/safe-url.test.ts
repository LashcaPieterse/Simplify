import assert from "node:assert/strict";
import test from "node:test";

import { normalizeHttpUrl } from "./safe-url";

test("safe URL normalization accepts only credential-free HTTP(S) URLs", () => {
  assert.equal(
    normalizeHttpUrl(" https://sim.africa/help "),
    "https://sim.africa/help",
  );
  assert.equal(normalizeHttpUrl("javascript:alert(1)"), null);
  assert.equal(normalizeHttpUrl("data:text/html,unsafe"), null);
  assert.equal(normalizeHttpUrl("https://user:secret@sim.africa"), null);
  assert.equal(normalizeHttpUrl("not a URL"), null);
});
