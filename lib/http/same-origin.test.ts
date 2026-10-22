import assert from "node:assert/strict";
import test from "node:test";
import { isSameOriginRequest } from "./same-origin";

test("currency and checkout writes validate the configured public origin across proxies", () => {
  const previous = process.env.NEXT_PUBLIC_APP_URL;
  process.env.NEXT_PUBLIC_APP_URL = "https://sim.africa";
  try {
    const request = (origin?: string) => new Request("http://internal:3000/api/checkouts", { method: "POST", headers: origin ? { origin } : {} });
    assert.equal(isSameOriginRequest(request("https://sim.africa")), true);
    assert.equal(isSameOriginRequest(request("https://evil.example")), false);
    assert.equal(isSameOriginRequest(request("https://sim.africa.evil.example")), false);
    assert.equal(isSameOriginRequest(request()), false);
    assert.equal(isSameOriginRequest(new Request("http://internal:3000/api/currency-preference")), true);
  } finally { if (previous === undefined) delete process.env.NEXT_PUBLIC_APP_URL; else process.env.NEXT_PUBLIC_APP_URL = previous; }
});
