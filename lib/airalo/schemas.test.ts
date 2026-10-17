import assert from "node:assert/strict";
import test from "node:test";

import { ListOrdersResponseSchema, OrderResponseSchema, SimResponseSchema } from "./schemas";

const deviceApn = {
  ios: { apn_type: "automatic", apn_value: "globaldata" },
  android: { apn_type: "manual", apn_value: "globaldata" },
};

test("order responses accept documented device APNs and legacy string APNs", () => {
  for (const apn of [deviceApn, "globaldata", null, undefined]) {
    const order = { id: 123, apn, sims: [{ iccid: "test-iccid", apn }] };
    const response = OrderResponseSchema.parse({ data: order });
    assert.deepEqual(response.data.apn, apn);
    assert.deepEqual(response.data.sims?.[0]?.apn, apn);
    const list = ListOrdersResponseSchema.parse({ data: [order] });
    assert.deepEqual(list.data[0]?.sims?.[0]?.apn, apn);
  }
});

test("SIM responses preserve device APNs, including partial and null settings", () => {
  for (const apn of [deviceApn, { ios: null, android: { apn_type: "automatic", apn_value: null } }, {}]) {
    const sim = SimResponseSchema.parse({ data: {
      id: 1, created_at: "2026-10-17", iccid: "test-iccid", apn,
    } });
    assert.deepEqual(sim.data.apn, apn);
  }
});

test("invalid APN field types still fail validation", () => {
  for (const apn of [123, [], { ios: { apn_value: 123 } }, { android: "globaldata" }]) {
    assert.equal(OrderResponseSchema.safeParse({ data: { sims: [{ apn }] } }).success, false);
  }
});
