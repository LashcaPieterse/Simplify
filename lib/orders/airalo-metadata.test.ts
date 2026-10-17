import assert from "node:assert/strict";
import test from "node:test";

import { OrderResponseSchema, SimResponseSchema } from "../airalo/schemas";
import { createInstallationPayload } from "./airalo-metadata";

test("different device APNs remain separate instead of selecting one for both devices", () => {
  const apn = {
    ios: { apn_type: "manual", apn_value: "iphone-apn" },
    android: { apn_type: "manual", apn_value: "android-apn" },
  };
  const order = OrderResponseSchema.parse({ data: { sims: [{
    iccid: "test-iccid", qrcode: "LPA:1$rsp.example$activation", apn,
  }] } }).data;
  const payload = JSON.parse(createInstallationPayload(order));
  assert.equal(payload.apn, null);
  assert.deepEqual(payload.apnSettings, apn);
  assert.equal(payload.qrCodeData, "LPA:1$rsp.example$activation");
  assert.equal(payload.activationCode, "activation");
});

test("Get SIM hydration preserves per-device APNs and uses the legacy flat fallback", () => {
  const sim = SimResponseSchema.parse({ data: {
    id: 1, created_at: "2026-10-17", iccid: "test-iccid", apn_value: "globaldata",
    apn: { ios: { apn_type: "automatic", apn_value: null }, android: null },
  } }).data;
  const payload = JSON.parse(createInstallationPayload(null, sim));
  assert.equal(payload.apn, "globaldata");
  assert.deepEqual(payload.apnSettings, { ios: { apn_type: "automatic", apn_value: null } });
});

test("absent or empty device APNs preserve legacy flat values without stringifying objects", () => {
  for (const apn of [null, {}, { ios: { apn_value: " " } }]) {
    const order = OrderResponseSchema.parse({ data: { sims: [{ apn, apn_value: " legacy-apn " }] } }).data;
    const payload = JSON.parse(createInstallationPayload(order));
    assert.equal(payload.apn, "legacy-apn");
    assert.equal(payload.apnSettings, null);
  }
});
