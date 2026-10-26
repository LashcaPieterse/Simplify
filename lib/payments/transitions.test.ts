import assert from "node:assert/strict";
import test from "node:test";
import { paymentState } from "./transitions";

test("DPO status contract permits only verified 000 to become approved", () => {
  const expected: Record<string, string> = {
    "000": "approved", "001": "authorized", "003": "pending", "005": "pending", "900": "pending",
    "007": "partially_paid", "901": "declined", "903": "expired", "904": "cancelled",
    "002": "verification_mismatch", "902": "verification_mismatch",
    "100": "verification_error", "999": "verification_error", "": "verification_error", "approved": "verification_error",
  };
  for (const [code, state] of Object.entries(expected)) assert.equal(paymentState(code), state, code);
});
